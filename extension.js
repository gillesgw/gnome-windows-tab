import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import Gio from 'gi://Gio';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';

const TAB_HEIGHT = 36;
const TAB_MIN_WIDTH = 150;
const TAB_MAX_WIDTH = 250;

// Individual tab representing a window with drag and drop support
const WindowTab = GObject.registerClass({
    Signals: {
        'tab-close': {},
        'tab-activate': {},
        'tab-detach': {},
    },
}, class WindowTab extends St.Button {
    _init(window, group) {
        super._init({
            style_class: 'window-tab-item',
            x_expand: false,
            y_expand: true,
            reactive: true,
            can_focus: true,
            track_hover: true,
        });

        this._window = window;
        this._group = group;
        this._dragging = false;

        // Create tab content
        const box = new St.BoxLayout({
            vertical: false,
            style_class: 'window-tab-box',
        });

        // Window icon
        const app = Shell.WindowTracker.get_default().get_window_app(window);
        if (app) {
            this._icon = app.create_icon_texture(16);
            box.add_child(this._icon);
        }

        // Window title
        this._label = new St.Label({
            text: this._truncateTitle(window.get_title() || 'Unknown'),
            y_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(this._label);

        // Close button
        const closeButton = new St.Button({
            style_class: 'window-tab-close',
            child: new St.Icon({
                icon_name: 'window-close-symbolic',
                icon_size: 14,
            }),
        });
        closeButton.connect('clicked', (event) => {
            event.stopPropagation();
            this.emit('tab-close');
            return Clutter.EVENT_STOP;
        });
        box.add_child(closeButton);

        this.set_child(box);

        // Connect signals
        this.connect('clicked', () => {
            this.emit('tab-activate');
        });

        this._windowTitleId = window.connect('notify::title', () => {
            this._updateTitle();
        });

        // Enable drag and drop
        this._draggable = DND.makeDraggable(this, {
            restoreOnSuccess: false,
            manualMode: true,
        });

        this._draggable.connect('drag-begin', () => {
            this._dragging = true;
        });

        this._draggable.connect('drag-end', () => {
            this._dragging = false;
        });

        this._draggable.connect('drag-cancelled', () => {
            this._dragging = false;
        });

        // Long press to start drag
        this._longPressGesture = new Clutter.GestureAction();
        this._longPressGesture.connect('gesture-begin', () => {
            if (!this._dragging) {
                this._draggable.startDrag(
                    global.get_pointer()[0],
                    global.get_pointer()[1],
                    global.get_current_time(),
                    null,
                    null
                );
            }
            return false;
        });
        this.add_action(this._longPressGesture);
    }

    _truncateTitle(title) {
        if (title.length > 25) {
            return title.substring(0, 22) + '...';
        }
        return title;
    }

    _updateTitle() {
        if (this._window) {
            this._label.set_text(this._truncateTitle(this._window.get_title() || 'Unknown'));
        }
    }

    getWindow() {
        return this._window;
    }

    setActive(active) {
        if (active) {
            this.add_style_class_name('active');
        } else {
            this.remove_style_class_name('active');
        }
    }

    getDragActor() {
        const clone = new Clutter.Clone({
            source: this,
            reactive: false,
        });
        return clone;
    }

    getDragActorSource() {
        return this;
    }

    acceptDrop(source, actor, x, y, time) {
        if (source instanceof WindowTab && source !== this) {
            // Merge the dragged tab with this tab's group
            this.emit('tab-detach');
            return true;
        }
        return false;
    }

    destroy() {
        if (this._windowTitleId && this._window) {
            this._window.disconnect(this._windowTitleId);
            this._windowTitleId = null;
        }
        if (this._longPressGesture) {
            this.remove_action(this._longPressGesture);
            this._longPressGesture = null;
        }
        this._window = null;
        super.destroy();
    }
});

// Tab bar overlay that appears below window title bar
const TabBarOverlay = GObject.registerClass(
class TabBarOverlay extends St.BoxLayout {
    _init(group) {
        super._init({
            style_class: 'window-tab-bar-overlay',
            vertical: false,
            reactive: true,
            track_hover: true,
        });

        this._group = group;
        this._tabs = [];
        this._activeTab = null;

        // Tab container with scroll
        this._scrollView = new St.ScrollView({
            style_class: 'window-tab-scroll',
            hscrollbar_policy: St.PolicyType.AUTOMATIC,
            vscrollbar_policy: St.PolicyType.NEVER,
            x_expand: true,
        });

        this._tabContainer = new St.BoxLayout({
            style_class: 'window-tab-container',
            vertical: false,
        });

        this._scrollView.add_actor(this._tabContainer);
        this.add_child(this._scrollView);

        // New tab button
        const newTabButton = new St.Button({
            style_class: 'window-tab-new',
            child: new St.Icon({
                icon_name: 'list-add-symbolic',
                icon_size: 16,
            }),
        });
        newTabButton.connect('clicked', () => {
            this._createNewWindow();
        });
        this.add_child(newTabButton);

        // Add to UI group for overlay
        Main.layoutManager.addChrome(this, {
            affectsStruts: false,
            trackFullscreen: false,
        });

        this.hide();
    }

    addTab(window) {
        const tab = new WindowTab(window, this._group);

        tab.connect('tab-close', () => {
            this._closeTab(tab);
        });

        tab.connect('tab-activate', () => {
            this._activateTab(tab);
        });

        tab.connect('tab-detach', () => {
            this._detachTab(tab);
        });

        this._tabs.push(tab);
        this._tabContainer.add_child(tab);

        if (this._tabs.length === 1) {
            this._activateTab(tab);
        }

        if (this._tabs.length >= 2) {
            this.show();
        }

        return tab;
    }

    removeTab(window) {
        const index = this._tabs.findIndex(tab => tab.getWindow() === window);
        if (index !== -1) {
            const tab = this._tabs[index];
            this._tabs.splice(index, 1);
            tab.destroy();

            if (this._activeTab === tab) {
                if (this._tabs.length > 0) {
                    const newIndex = Math.min(index, this._tabs.length - 1);
                    this._activateTab(this._tabs[newIndex]);
                } else {
                    this._activeTab = null;
                }
            }

            // Hide tab bar if only one tab remains
            if (this._tabs.length < 2) {
                this.hide();
            }

            return this._tabs.length === 0;
        }
        return false;
    }

    _activateTab(tab) {
        if (this._activeTab) {
            this._activeTab.setActive(false);
        }

        this._activeTab = tab;
        tab.setActive(true);

        // Notify group to switch windows
        this._group.activateWindow(tab.getWindow());
    }

    _closeTab(tab) {
        const window = tab.getWindow();
        if (window) {
            window.delete(global.get_current_time());
        }
    }

    _detachTab(tab) {
        const window = tab.getWindow();
        this._group.detachWindow(window);
    }

    _createNewWindow() {
        if (this._tabs.length > 0 && this._activeTab) {
            const window = this._activeTab.getWindow();
            const app = Shell.WindowTracker.get_default().get_window_app(window);
            if (app) {
                app.open_new_window(-1);
            }
        }
    }

    updatePosition(window) {
        const rect = window.get_frame_rect();
        const monitor = Main.layoutManager.findMonitorForActor(global.stage);

        if (monitor) {
            // Position below title bar
            const titleBarHeight = rect.y - window.get_buffer_rect().y;
            this.set_position(rect.x, rect.y + titleBarHeight);
            this.set_width(rect.width);
            this.set_height(TAB_HEIGHT);
        }
    }

    getTabCount() {
        return this._tabs.length;
    }

    destroy() {
        this._tabs.forEach(tab => tab.destroy());
        this._tabs = [];
        Main.layoutManager.removeChrome(this);
        super.destroy();
    }
});

// Group of windows from the same application
const WindowTabGroup = GObject.registerClass(
class WindowTabGroup extends GObject.Object {
    _init(app, settings) {
        super._init();

        this._app = app;
        this._settings = settings;
        this._windows = new Map(); // window -> metadata
        this._activeWindow = null;
        this._tabBar = new TabBarOverlay(this);
        this._updatePositionTimeoutId = null;
    }

    addWindow(window) {
        if (this._windows.has(window)) {
            return;
        }

        // Store window metadata
        const metadata = {
            sizeChangedId: window.connect('size-changed', () => this._onWindowChanged(window)),
            positionChangedId: window.connect('position-changed', () => this._onWindowChanged(window)),
            focusId: window.connect('focus', () => this._onWindowFocused(window)),
        };

        this._windows.set(window, metadata);
        this._tabBar.addTab(window);

        // If this is the first window or focused window, make it active
        if (this._windows.size === 1 || window.has_focus()) {
            this.activateWindow(window);
        } else if (this._windows.size >= 2) {
            // Hide non-active windows when grouping
            if (window !== this._activeWindow) {
                this._hideWindow(window);
            }
        }

        this._updateTabBarPosition();
    }

    removeWindow(window) {
        const metadata = this._windows.get(window);
        if (!metadata) {
            return false;
        }

        // Disconnect signals
        if (metadata.sizeChangedId) window.disconnect(metadata.sizeChangedId);
        if (metadata.positionChangedId) window.disconnect(metadata.positionChangedId);
        if (metadata.focusId) window.disconnect(metadata.focusId);

        this._windows.delete(window);
        const isEmpty = this._tabBar.removeTab(window);

        if (this._activeWindow === window) {
            this._activeWindow = null;
        }

        return isEmpty;
    }

    detachWindow(window) {
        // Remove from group but don't close window
        const metadata = this._windows.get(window);
        if (metadata) {
            if (metadata.sizeChangedId) window.disconnect(metadata.sizeChangedId);
            if (metadata.positionChangedId) window.disconnect(metadata.positionChangedId);
            if (metadata.focusId) window.disconnect(metadata.focusId);
            this._windows.delete(window);
        }

        this._tabBar.removeTab(window);
        this._showWindow(window);

        return this._windows.size === 0;
    }

    activateWindow(window) {
        if (!this._windows.has(window)) {
            return;
        }

        // Hide previous active window
        if (this._activeWindow && this._activeWindow !== window) {
            this._hideWindow(this._activeWindow);
        }

        // Show and activate new window
        this._activeWindow = window;
        this._showWindow(window);

        if (!window.has_focus()) {
            window.activate(global.get_current_time());
        }

        this._updateTabBarPosition();
    }

    _hideWindow(window) {
        if (!window.minimized) {
            window.minimize();
        }
    }

    _showWindow(window) {
        if (window.minimized) {
            window.unminimize();
        }
        window.raise();
    }

    _onWindowChanged(window) {
        if (window === this._activeWindow) {
            if (this._updatePositionTimeoutId) {
                GLib.source_remove(this._updatePositionTimeoutId);
            }
            this._updatePositionTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
                this._updateTabBarPosition();
                this._updatePositionTimeoutId = null;
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    _onWindowFocused(window) {
        if (window !== this._activeWindow) {
            this.activateWindow(window);
        }
    }

    _updateTabBarPosition() {
        if (this._activeWindow && this._tabBar.getTabCount() >= 2) {
            this._tabBar.updatePosition(this._activeWindow);
            this._tabBar.show();
        } else {
            this._tabBar.hide();
        }
    }

    getWindowCount() {
        return this._windows.size;
    }

    hasWindow(window) {
        return this._windows.has(window);
    }

    getApp() {
        return this._app;
    }

    destroy() {
        // Clean up all windows
        this._windows.forEach((metadata, window) => {
            if (metadata.sizeChangedId) window.disconnect(metadata.sizeChangedId);
            if (metadata.positionChangedId) window.disconnect(metadata.positionChangedId);
            if (metadata.focusId) window.disconnect(metadata.focusId);
            this._showWindow(window); // Restore hidden windows
        });
        this._windows.clear();

        if (this._updatePositionTimeoutId) {
            GLib.source_remove(this._updatePositionTimeoutId);
            this._updatePositionTimeoutId = null;
        }

        this._tabBar.destroy();
    }
});

// Main manager that tracks all windows and creates groups
const WindowTabsManager = class WindowTabsManager {
    constructor(settings) {
        this._settings = settings;
        this._groups = new Map(); // app -> WindowTabGroup
        this._windowTracker = Shell.WindowTracker.get_default();
        this._display = global.display;

        // Connect to window signals
        this._windowCreatedId = this._display.connect('window-created', (display, window) => {
            this._onWindowCreated(window);
        });

        // Track existing windows
        const windows = this._display.get_tab_list(Meta.TabList.NORMAL, null);
        windows.forEach(window => {
            if (this._shouldTrackWindow(window)) {
                this._onWindowCreated(window);
            }
        });
    }

    _shouldTrackWindow(window) {
        if (!window || window.is_skip_taskbar()) {
            return false;
        }

        const windowType = window.get_window_type();
        return windowType === Meta.WindowType.NORMAL;
    }

    _onWindowCreated(window) {
        if (!this._shouldTrackWindow(window)) {
            return;
        }

        const app = this._windowTracker.get_window_app(window);
        if (!app) {
            return;
        }

        // Connect to unmanage signal
        window._tabsUnmanageId = window.connect('unmanaged', () => {
            this._onWindowClosed(window);
        });

        // Get or create group for this app
        let group = this._groups.get(app);
        if (!group) {
            group = new WindowTabGroup(app, this._settings);
            this._groups.set(app, group);
        }

        // Add window to group
        group.addWindow(window);
    }

    _onWindowClosed(window) {
        if (window._tabsUnmanageId) {
            window.disconnect(window._tabsUnmanageId);
            window._tabsUnmanageId = null;
        }

        // Find and remove from group
        const app = this._windowTracker.get_window_app(window);
        if (app) {
            const group = this._groups.get(app);
            if (group) {
                const isEmpty = group.removeWindow(window);
                if (isEmpty) {
                    group.destroy();
                    this._groups.delete(app);
                }
            }
        }
    }

    destroy() {
        // Disconnect signals
        if (this._windowCreatedId) {
            this._display.disconnect(this._windowCreatedId);
            this._windowCreatedId = null;
        }

        // Clean up all window signals
        const windows = this._display.get_tab_list(Meta.TabList.NORMAL, null);
        windows.forEach(window => {
            if (window._tabsUnmanageId) {
                window.disconnect(window._tabsUnmanageId);
                window._tabsUnmanageId = null;
            }
        });

        // Destroy all groups
        this._groups.forEach(group => group.destroy());
        this._groups.clear();
    }
};

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
