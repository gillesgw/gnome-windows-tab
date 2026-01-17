import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import Gio from 'gi://Gio';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Workspace} from 'resource:///org/gnome/shell/ui/workspace.js';

const TAB_BAR_HEIGHT = 28;

// Set to track hidden windows (inactive in tab groups)
const hiddenWindows = new Set();

// Global reference to manager
let _manager = null;

// Individual tab button with ungroup button
const WindowTab = GObject.registerClass({
    Signals: {
        'clicked': {},
        'close-clicked': {},
        'ungroup-clicked': {},
    },
}, class WindowTab extends St.BoxLayout {
    _init(metaWindow, tabNumber, tabBar, showUngroup) {
        super._init({
            style_class: 'window-tab',
            reactive: true,
            track_hover: true,
            x_expand: false,
        });

        this._metaWindow = metaWindow;
        this._tabBar = tabBar;
        this._active = false;
        this._tabNumber = tabNumber;

        // Tab number
        this._numberLabel = new St.Label({
            text: `${tabNumber}`,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'window-tab-number',
        });
        this.add_child(this._numberLabel);

        // Title label
        this._label = new St.Label({
            text: this._truncate(metaWindow.get_title() || 'Sans titre'),
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            style_class: 'window-tab-label',
        });
        this.add_child(this._label);

        // Ungroup button (only if more than 1 tab)
        if (showUngroup) {
            this._ungroupBtn = new St.Button({
                style_class: 'window-tab-ungroup',
                child: new St.Icon({icon_name: 'window-restore-symbolic', icon_size: 12}),
            });
            this._ungroupBtn.connect('clicked', () => {
                this.emit('ungroup-clicked');
                return Clutter.EVENT_STOP;
            });
            this.add_child(this._ungroupBtn);
        }

        // Close button
        this._closeBtn = new St.Button({
            style_class: 'window-tab-close',
            child: new St.Icon({icon_name: 'window-close-symbolic', icon_size: 12}),
        });
        this._closeBtn.connect('clicked', () => {
            this.emit('close-clicked');
            return Clutter.EVENT_STOP;
        });
        this.add_child(this._closeBtn);

        // Click handling
        this.connect('button-press-event', (actor, event) => {
            if (event.get_button() === 1) {
                this.emit('clicked');
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        // Title updates
        this._titleId = metaWindow.connect('notify::title', () => {
            this._label.set_text(this._truncate(metaWindow.get_title() || 'Sans titre'));
        });
    }

    setNumber(num) {
        this._tabNumber = num;
        this._numberLabel.set_text(`${num}`);
    }

    _truncate(text) {
        return text.length > 25 ? text.substring(0, 23) + '…' : text;
    }

    setActive(active) {
        this._active = active;
        if (active) {
            this.add_style_class_name('active');
        } else {
            this.remove_style_class_name('active');
        }
    }

    setShowUngroup(show) {
        if (show && !this._ungroupBtn) {
            this._ungroupBtn = new St.Button({
                style_class: 'window-tab-ungroup',
                child: new St.Icon({icon_name: 'window-restore-symbolic', icon_size: 12}),
            });
            this._ungroupBtn.connect('clicked', () => {
                this.emit('ungroup-clicked');
                return Clutter.EVENT_STOP;
            });
            // Insert before close button
            const closeIdx = this.get_children().indexOf(this._closeBtn);
            this.insert_child_at_index(this._ungroupBtn, closeIdx);
        } else if (!show && this._ungroupBtn) {
            this._ungroupBtn.destroy();
            this._ungroupBtn = null;
        }
    }

    get metaWindow() {
        return this._metaWindow;
    }

    destroy() {
        if (this._titleId && this._metaWindow) {
            this._metaWindow.disconnect(this._titleId);
            this._titleId = null;
        }
        super.destroy();
    }
});

// Tab bar attached directly to window actor
const WindowTabBar = GObject.registerClass(
class WindowTabBar extends St.BoxLayout {
    _init(manager, app, initialWindow) {
        super._init({
            style_class: 'window-tab-bar',
            reactive: true,
            height: TAB_BAR_HEIGHT,
        });

        this._manager = manager;
        this._app = app;
        this._windows = [];
        this._tabs = new Map();
        this._activeWindow = null;
        this._attachedToActor = null;
        this._isVisible = false;
        this._isTiled = false;
        this._tileMode = null;

        // Reference geometry for all grouped windows
        this._referenceRect = null;

        // Tabs container
        this._tabsContainer = new St.BoxLayout({
            style_class: 'window-tab-bar-container',
            x_expand: true,
        });
        this.add_child(this._tabsContainer);

        // New window button
        this._newBtn = new St.Button({
            style_class: 'window-tab-new',
            child: new St.Icon({icon_name: 'list-add-symbolic', icon_size: 14}),
        });
        this._newBtn.connect('clicked', () => {
            if (this._app) this._app.open_new_window(-1);
        });
        this.add_child(this._newBtn);

        // Add initial window
        this._addWindow(initialWindow, true);
    }

    _addWindow(metaWindow, isFirst = false) {
        if (this._tabs.has(metaWindow)) return;

        this._windows.push(metaWindow);
        const tabNumber = this._windows.length;
        const showUngroup = this._windows.length > 1;

        const tab = new WindowTab(metaWindow, tabNumber, this, showUngroup);
        tab.connect('clicked', () => this._activateWindow(metaWindow));
        tab.connect('close-clicked', () => metaWindow.delete(global.get_current_time()));
        tab.connect('ungroup-clicked', () => this._manager.ungroupWindow(metaWindow, this));

        this._tabs.set(metaWindow, tab);
        this._tabsContainer.add_child(tab);

        // Update ungroup buttons visibility
        this._updateUngroupButtons();

        // Connect window signals
        const signals = {
            focus: metaWindow.connect('focus', () => this._onWindowFocus(metaWindow)),
            unmanaged: metaWindow.connect('unmanaged', () => this._onWindowUnmanaged(metaWindow)),
        };
        metaWindow._tabSignals = signals;

        // If first window, set reference and activate
        if (isFirst) {
            this._referenceRect = metaWindow.get_frame_rect();
            this._activeWindow = metaWindow;
            tab.setActive(true);
        } else {
            // New window joins existing group - apply reference geometry immediately
            if (this._referenceRect) {
                // Skip animation for this window
                const actor = metaWindow.get_compositor_private();
                if (actor) {
                    Main.wm.skipNextEffect(actor);
                }

                // Apply geometry
                metaWindow.move_resize_frame(
                    false,
                    this._referenceRect.x,
                    this._referenceRect.y,
                    this._referenceRect.width,
                    this._referenceRect.height
                );
            }

            // Minimize this window (it's not the active tab)
            const actor = metaWindow.get_compositor_private();
            if (actor) {
                Main.wm.skipNextEffect(actor);
            }
            metaWindow.minimize();
            hiddenWindows.add(metaWindow);
        }

        this._updateAttachment();
    }

    _updateUngroupButtons() {
        const showUngroup = this._windows.length > 1;
        this._tabs.forEach(tab => tab.setShowUngroup(showUngroup));
    }

    _syncWindowGeometry(metaWindow) {
        if (!this._referenceRect) return;
        if (metaWindow.minimized) return;

        const actor = metaWindow.get_compositor_private();
        if (actor) {
            Main.wm.skipNextEffect(actor);
        }

        metaWindow.move_resize_frame(
            false,
            this._referenceRect.x,
            this._referenceRect.y,
            this._referenceRect.width,
            this._referenceRect.height
        );
    }

    _syncAllWindowsGeometry() {
        if (!this._referenceRect || this._windows.length < 2) return;

        this._windows.forEach(win => {
            if (win !== this._activeWindow && !win.minimized) {
                this._syncWindowGeometry(win);
            }
        });
    }

    addWindow(metaWindow) {
        this._addWindow(metaWindow, false);
    }

    _activateWindow(metaWindow) {
        if (this._activeWindow === metaWindow) return;

        // Update visual state
        this._tabs.forEach((tab, win) => tab.setActive(win === metaWindow));

        const previousActive = this._activeWindow;

        // Minimize previous active window (skip animation)
        if (previousActive && previousActive !== metaWindow && !previousActive.minimized) {
            const prevActor = previousActive.get_compositor_private();
            if (prevActor) {
                Main.wm.skipNextEffect(prevActor);
            }
            previousActive.minimize();
            hiddenWindows.add(previousActive);
        }

        this._activeWindow = metaWindow;
        hiddenWindows.delete(metaWindow);

        // Unminimize and activate (skip animation)
        const actor = metaWindow.get_compositor_private();
        if (actor) {
            Main.wm.skipNextEffect(actor);
        }

        if (metaWindow.minimized) {
            metaWindow.unminimize();
        }

        metaWindow.activate(global.get_current_time());

        // Update reference rect from active window (but not if tiled)
        if (!this._isTiled) {
            this._referenceRect = metaWindow.get_frame_rect();
        }

        this._updateAttachment();
        this._manager.onWindowActivated(this);
    }

    _onWindowFocus(metaWindow) {
        if (metaWindow === this._activeWindow) return;
        if (!this._windows.includes(metaWindow)) return;

        // This is called when user focuses a window externally (Alt+Tab, etc.)
        // We need to handle the tab switch

        // Skip animation for this window
        const actor = metaWindow.get_compositor_private();
        if (actor) {
            Main.wm.skipNextEffect(actor);
        }

        // Update tabs visual
        this._tabs.forEach((tab, win) => tab.setActive(win === metaWindow));

        // Minimize previous active
        const previousActive = this._activeWindow;
        if (previousActive && !previousActive.minimized) {
            const prevActor = previousActive.get_compositor_private();
            if (prevActor) {
                Main.wm.skipNextEffect(prevActor);
            }
            previousActive.minimize();
            hiddenWindows.add(previousActive);
        }

        this._activeWindow = metaWindow;
        hiddenWindows.delete(metaWindow);

        if (!this._isTiled) {
            this._referenceRect = metaWindow.get_frame_rect();
        }

        this._updateAttachment();
        this._manager.onWindowActivated(this);
    }

    _onWindowUnmanaged(metaWindow) {
        this._manager.onWindowRemoved(metaWindow);
    }

    removeWindow(metaWindow) {
        const tab = this._tabs.get(metaWindow);
        if (!tab) return false;

        hiddenWindows.delete(metaWindow);

        if (metaWindow._tabSignals) {
            try {
                metaWindow.disconnect(metaWindow._tabSignals.focus);
                metaWindow.disconnect(metaWindow._tabSignals.unmanaged);
            } catch (e) {}
            delete metaWindow._tabSignals;
        }

        this._tabs.delete(metaWindow);
        tab.destroy();

        const idx = this._windows.indexOf(metaWindow);
        if (idx !== -1) this._windows.splice(idx, 1);

        this._renumberTabs();
        this._updateUngroupButtons();

        if (this._activeWindow === metaWindow) {
            this._activeWindow = null;
            if (this._windows.length > 0) {
                const nextIdx = Math.min(idx, this._windows.length - 1);
                this._activateWindow(this._windows[nextIdx]);
            }
        }

        this._updateAttachment();
        return this._windows.length === 0;
    }

    _renumberTabs() {
        this._windows.forEach((win, index) => {
            const tab = this._tabs.get(win);
            if (tab) {
                tab.setNumber(index + 1);
            }
        });
    }

    _updateAttachment() {
        const targetWindow = this._activeWindow || this._windows[0];
        if (!targetWindow) {
            this._detach();
            return;
        }

        const windowActor = targetWindow.get_compositor_private();
        if (!windowActor) return;

        if (this._windows.length < 2) {
            this._detach();
            return;
        }

        if (!this._attachedToActor) {
            this._attachToActor(windowActor, targetWindow);
        } else if (this._attachedToActor !== windowActor) {
            this._detach();
            this._attachToActor(windowActor, targetWindow);
        } else {
            this._updatePosition(targetWindow, windowActor);
        }
    }

    _attachToActor(windowActor, metaWindow) {
        const windowGroup = global.window_group;
        windowGroup.add_child(this);

        this._updatePosition(metaWindow, windowActor);

        this._posChangedId = metaWindow.connect('position-changed', () => {
            this._updatePosition(metaWindow, windowActor);
            if (!this._isTiled) {
                this._referenceRect = metaWindow.get_frame_rect();
                this._syncAllWindowsGeometry();
            }
        });

        this._sizeChangedId = metaWindow.connect('size-changed', () => {
            this._handleTileOrMaximize(metaWindow);
            this._updatePosition(metaWindow, windowActor);
            if (!this._isTiled) {
                this._referenceRect = metaWindow.get_frame_rect();
                this._syncAllWindowsGeometry();
            }
        });

        this._attachedToActor = windowActor;
        this._attachedWindow = metaWindow;
        this._isVisible = true;

        // Check initial tile/maximize state
        this._handleTileOrMaximize(metaWindow);

        this.show();
    }

    _handleTileOrMaximize(metaWindow) {
        const maxH = metaWindow.maximized_horizontally;
        const maxV = metaWindow.maximized_vertically;
        const isFullscreen = metaWindow.is_fullscreen();

        let newTileMode = null;

        if (isFullscreen || (maxH && maxV)) {
            newTileMode = 'maximize';
        } else if (maxH && !maxV) {
            newTileMode = 'maximize';
        } else if (!maxH && maxV) {
            const rect = metaWindow.get_frame_rect();
            const monitor = metaWindow.get_monitor();
            const workspace = metaWindow.get_workspace();
            const workArea = workspace.get_work_area_for_monitor(monitor);

            if (rect.x <= workArea.x + 10) {
                newTileMode = 'left';
            } else {
                newTileMode = 'right';
            }
        }

        if (newTileMode && !this._isTiled) {
            this._applyTiledLayout(metaWindow, newTileMode);
        } else if (!newTileMode && this._isTiled) {
            this._isTiled = false;
            this._tileMode = null;
        }
    }

    _applyTiledLayout(metaWindow, mode) {
        const workspace = metaWindow.get_workspace();
        const monitor = metaWindow.get_monitor();
        const workArea = workspace.get_work_area_for_monitor(monitor);

        if (metaWindow.maximized_horizontally || metaWindow.maximized_vertically) {
            metaWindow.unmaximize(Meta.MaximizeFlags.BOTH);
        }

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
            let x, y, width, height;

            if (mode === 'maximize') {
                x = workArea.x;
                y = workArea.y + TAB_BAR_HEIGHT;
                width = workArea.width;
                height = workArea.height - TAB_BAR_HEIGHT;
            } else if (mode === 'left') {
                x = workArea.x;
                y = workArea.y + TAB_BAR_HEIGHT;
                width = Math.floor(workArea.width / 2);
                height = workArea.height - TAB_BAR_HEIGHT;
            } else if (mode === 'right') {
                x = workArea.x + Math.floor(workArea.width / 2);
                y = workArea.y + TAB_BAR_HEIGHT;
                width = Math.floor(workArea.width / 2);
                height = workArea.height - TAB_BAR_HEIGHT;
            }

            const actor = metaWindow.get_compositor_private();
            if (actor) {
                Main.wm.skipNextEffect(actor);
            }

            metaWindow.move_resize_frame(false, x, y, width, height);
            this._isTiled = true;
            this._tileMode = mode;
            this._referenceRect = {x, y, width, height};
            this._syncAllWindowsGeometry();
            this._updatePosition(metaWindow, metaWindow.get_compositor_private());

            return GLib.SOURCE_REMOVE;
        });
    }

    _updatePosition(metaWindow, windowActor) {
        if (!windowActor) return;

        const rect = metaWindow.get_frame_rect();

        this.set_position(rect.x, rect.y - TAB_BAR_HEIGHT);
        this.set_width(rect.width);

        const windowGroup = global.window_group;
        if (this.get_parent() === windowGroup) {
            windowGroup.set_child_above_sibling(this, windowActor);
        }
    }

    setVisible(visible) {
        if (visible && this._windows.length >= 2) {
            this.show();
            this._isVisible = true;
        } else {
            this.hide();
            this._isVisible = false;
        }
    }

    _detach() {
        if (this._posChangedId && this._attachedWindow) {
            this._attachedWindow.disconnect(this._posChangedId);
            this._posChangedId = null;
        }
        if (this._sizeChangedId && this._attachedWindow) {
            this._attachedWindow.disconnect(this._sizeChangedId);
            this._sizeChangedId = null;
        }

        if (this.get_parent()) {
            this.get_parent().remove_child(this);
        }

        this._attachedToActor = null;
        this._attachedWindow = null;
        this._isVisible = false;
        this._isTiled = false;
        this._tileMode = null;
    }

    get windowCount() {
        return this._windows.length;
    }

    get activeWindow() {
        return this._activeWindow;
    }

    get windows() {
        return this._windows;
    }

    hasWindow(win) {
        return this._tabs.has(win);
    }

    destroy() {
        this._detach();

        this._windows.forEach(win => {
            hiddenWindows.delete(win);
            if (win._tabSignals) {
                try {
                    win.disconnect(win._tabSignals.focus);
                    win.disconnect(win._tabSignals.unmanaged);
                } catch (e) {}
                delete win._tabSignals;
            }
            if (win.minimized && win !== this._activeWindow) {
                const actor = win.get_compositor_private();
                if (actor) {
                    try { Main.wm.skipNextEffect(actor); } catch (e) {}
                }
                try { win.unminimize(); } catch (e) {}
            }
        });

        this._tabs.forEach(tab => tab.destroy());
        this._tabs.clear();
        this._windows = [];

        super.destroy();
    }
});

// Main extension manager
class WindowTabsManager {
    constructor(settings) {
        this._settings = settings;
        this._tabBars = new Map(); // app -> WindowTabBar
        this._windowToBar = new Map(); // window -> tabBar
        this._windowTracker = Shell.WindowTracker.get_default();
        this._activeTabBar = null;
        this._enabledApps = new Set();

        _manager = this;

        // Load enabled apps from settings
        this._loadEnabledApps();

        // Listen for settings changes
        this._settingsChangedId = this._settings.connect('changed::enabled-apps', () => {
            this._loadEnabledApps();
        });

        this._patchWorkspace();

        this._focusWindowId = global.display.connect('notify::focus-window', () => {
            this._onFocusChanged();
        });

        this._windowCreatedId = global.display.connect('window-created',
            (display, window) => this._onWindowCreated(window));

        // Intercept window minimize/unminimize to skip animations for our windows
        this._minimizeId = global.window_manager.connect('minimize', (wm, actor) => {
            const win = actor.meta_window;
            if (this._windowToBar.has(win)) {
                Main.wm.skipNextEffect(actor);
            }
        });

        this._unminimizeId = global.window_manager.connect('unminimize', (wm, actor) => {
            const win = actor.meta_window;
            if (this._windowToBar.has(win)) {
                Main.wm.skipNextEffect(actor);
            }
        });

        this._initTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
            this._initTimeoutId = null;
            global.display.get_tab_list(Meta.TabList.NORMAL, null)
                .forEach(w => this._onWindowCreated(w));
            return GLib.SOURCE_REMOVE;
        });
    }

    _loadEnabledApps() {
        this._enabledApps.clear();
        const apps = this._settings.get_strv('enabled-apps');
        apps.forEach(appId => this._enabledApps.add(appId));
    }

    _isAppEnabled(app) {
        if (!app) return false;
        const appId = app.get_id();
        return this._enabledApps.has(appId);
    }

    _patchWorkspace() {
        this._originalIsOverviewWindow = Workspace.prototype._isOverviewWindow;

        Workspace.prototype._isOverviewWindow = function(win) {
            if (hiddenWindows.has(win)) {
                return false;
            }
            return this._originalIsOverviewWindow ?
                this._originalIsOverviewWindow.call(this, win) :
                !win.skip_taskbar;
        }.bind({_originalIsOverviewWindow: this._originalIsOverviewWindow});
    }

    _unpatchWorkspace() {
        if (this._originalIsOverviewWindow) {
            Workspace.prototype._isOverviewWindow = this._originalIsOverviewWindow;
            this._originalIsOverviewWindow = null;
        }
    }

    _onFocusChanged() {
        const focusWindow = global.display.focus_window;
        if (!focusWindow) {
            this._hideAllTabBars();
            return;
        }

        const tabBar = this._windowToBar.get(focusWindow);
        if (tabBar) {
            this._showOnlyTabBar(tabBar);
        } else {
            this._hideAllTabBars();
        }
    }

    _showOnlyTabBar(activeBar) {
        this._tabBars.forEach(bar => {
            bar.setVisible(bar === activeBar);
        });
        this._activeTabBar = activeBar;
    }

    _hideAllTabBars() {
        this._tabBars.forEach(bar => bar.setVisible(false));
        this._activeTabBar = null;
    }

    onWindowActivated(tabBar) {
        this._showOnlyTabBar(tabBar);
    }

    ungroupWindow(metaWindow, fromTabBar) {
        if (fromTabBar.windowCount <= 1) return;

        // Remove window from its current group
        this._windowToBar.delete(metaWindow);
        hiddenWindows.delete(metaWindow);

        const isEmpty = fromTabBar.removeWindow(metaWindow);
        if (isEmpty) {
            for (const [app, bar] of this._tabBars) {
                if (bar === fromTabBar) {
                    this._tabBars.delete(app);
                    break;
                }
            }
            fromTabBar.destroy();
        }

        // Restore the ungrouped window
        const actor = metaWindow.get_compositor_private();
        if (actor) {
            Main.wm.skipNextEffect(actor);
        }
        if (metaWindow.minimized) {
            metaWindow.unminimize();
        }

        // Offset the window slightly so it's visible
        const rect = metaWindow.get_frame_rect();
        metaWindow.move_resize_frame(false, rect.x + 30, rect.y + 30, rect.width, rect.height);

        metaWindow.activate(global.get_current_time());

        // Mark as excluded from auto-grouping
        metaWindow._excludeFromTabGroup = true;

        this._onFocusChanged();
    }

    _shouldTrack(metaWindow) {
        if (!metaWindow) return false;
        if (metaWindow.is_skip_taskbar()) return false;
        if (metaWindow.get_window_type() !== Meta.WindowType.NORMAL) return false;
        if (metaWindow._excludeFromTabGroup) return false;

        // Check if app is in enabled list
        const app = this._windowTracker.get_window_app(metaWindow);
        if (!this._isAppEnabled(app)) return false;

        return true;
    }

    _onWindowCreated(metaWindow) {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            if (!this._shouldTrack(metaWindow)) return GLib.SOURCE_REMOVE;

            const app = this._windowTracker.get_window_app(metaWindow);
            if (!app) return GLib.SOURCE_REMOVE;

            // Don't add if already tracked
            if (this._windowToBar.has(metaWindow)) return GLib.SOURCE_REMOVE;

            let tabBar = this._tabBars.get(app);
            if (tabBar) {
                tabBar.addWindow(metaWindow);
            } else {
                tabBar = new WindowTabBar(this, app, metaWindow);
                this._tabBars.set(app, tabBar);
            }

            this._windowToBar.set(metaWindow, tabBar);
            this._onFocusChanged();

            return GLib.SOURCE_REMOVE;
        });
    }

    onWindowRemoved(metaWindow) {
        const tabBar = this._windowToBar.get(metaWindow);
        if (!tabBar) return;

        this._windowToBar.delete(metaWindow);
        hiddenWindows.delete(metaWindow);

        const isEmpty = tabBar.removeWindow(metaWindow);
        if (isEmpty) {
            for (const [app, bar] of this._tabBars) {
                if (bar === tabBar) {
                    this._tabBars.delete(app);
                    break;
                }
            }
            tabBar.destroy();
        }

        this._onFocusChanged();
    }

    destroy() {
        _manager = null;

        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }

        if (this._initTimeoutId) {
            GLib.source_remove(this._initTimeoutId);
            this._initTimeoutId = null;
        }

        if (this._windowCreatedId) {
            global.display.disconnect(this._windowCreatedId);
            this._windowCreatedId = null;
        }

        if (this._focusWindowId) {
            global.display.disconnect(this._focusWindowId);
            this._focusWindowId = null;
        }

        if (this._minimizeId) {
            global.window_manager.disconnect(this._minimizeId);
            this._minimizeId = null;
        }

        if (this._unminimizeId) {
            global.window_manager.disconnect(this._unminimizeId);
            this._unminimizeId = null;
        }

        this._unpatchWorkspace();
        hiddenWindows.clear();

        this._tabBars.forEach(bar => bar.destroy());
        this._tabBars.clear();
        this._windowToBar.clear();
    }
}

export default class WindowTabsExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._manager = new WindowTabsManager(this._settings);
    }

    disable() {
        if (this._manager) {
            this._manager.destroy();
            this._manager = null;
        }
        this._settings = null;
    }
}
