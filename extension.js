import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import Gio from 'gi://Gio';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

const TAB_HEIGHT = 32;
const TAB_MIN_WIDTH = 120;
const TAB_MAX_WIDTH = 200;

// Tab button that represents a window
const WindowTab = GObject.registerClass(
class WindowTab extends St.Button {
    _init(window, tabBar) {
        super._init({
            style_class: 'window-tab',
            x_expand: false,
            y_expand: true,
        });

        this._window = window;
        this._tabBar = tabBar;
        this._isClosed = false;

        // Create tab content
        const box = new St.BoxLayout({
            vertical: false,
            style_class: 'window-tab-box',
        });

        // Window icon
        const app = Shell.WindowTracker.get_default().get_window_app(window);
        if (app) {
            const icon = app.create_icon_texture(16);
            box.add_child(icon);
        }

        // Window title
        this._label = new St.Label({
            text: window.get_title() || 'Unknown',
            y_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(this._label);

        // Close button
        const closeButton = new St.Button({
            style_class: 'window-tab-close',
            child: new St.Icon({
                icon_name: 'window-close-symbolic',
                icon_size: 12,
            }),
        });
        closeButton.connect('clicked', () => {
            this._closeTab();
        });
        box.add_child(closeButton);

        this.set_child(box);

        // Connect signals
        this.connect('clicked', () => {
            this._tabBar.activateTab(this);
        });

        this._windowTitleId = window.connect('notify::title', () => {
            this._updateTitle();
        });

        this._windowFocusId = window.connect('focus', () => {
            this._tabBar.activateTab(this);
        });
    }

    _updateTitle() {
        if (this._window && !this._isClosed) {
            this._label.set_text(this._window.get_title() || 'Unknown');
        }
    }

    _closeTab() {
        this._isClosed = true;
        if (this._window) {
            this._window.delete(global.get_current_time());
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

    destroy() {
        if (this._windowTitleId) {
            this._window.disconnect(this._windowTitleId);
            this._windowTitleId = null;
        }
        if (this._windowFocusId) {
            this._window.disconnect(this._windowFocusId);
            this._windowFocusId = null;
        }
        this._window = null;
        super.destroy();
    }
});

// Tab bar that contains all tabs for a group of windows
const WindowTabBar = GObject.registerClass(
class WindowTabBar extends St.BoxLayout {
    _init() {
        super._init({
            style_class: 'window-tab-bar',
            vertical: false,
            x_expand: true,
            height: TAB_HEIGHT,
        });

        this._tabs = [];
        this._activeTab = null;
        this._windows = new Set();

        // Scroll view for tabs
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

        // Add new tab button
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
    }

    addWindow(window) {
        if (this._windows.has(window)) {
            return;
        }

        this._windows.add(window);
        const tab = new WindowTab(window, this);
        this._tabs.push(tab);
        this._tabContainer.add_child(tab);

        if (this._tabs.length === 1) {
            this.activateTab(tab);
        }

        return tab;
    }

    removeWindow(window) {
        const index = this._tabs.findIndex(tab => tab.getWindow() === window);
        if (index !== -1) {
            const tab = this._tabs[index];
            this._tabs.splice(index, 1);
            this._windows.delete(window);
            tab.destroy();

            if (this._activeTab === tab) {
                if (this._tabs.length > 0) {
                    const newIndex = Math.min(index, this._tabs.length - 1);
                    this.activateTab(this._tabs[newIndex]);
                } else {
                    this._activeTab = null;
                }
            }

            return this._tabs.length === 0;
        }
        return false;
    }

    activateTab(tab) {
        if (this._activeTab) {
            this._activeTab.setActive(false);
            const prevWindow = this._activeTab.getWindow();
            if (prevWindow && !prevWindow.minimized) {
                prevWindow.minimize();
            }
        }

        this._activeTab = tab;
        tab.setActive(true);

        const window = tab.getWindow();
        if (window) {
            if (window.minimized) {
                window.unminimize();
            }
            window.activate(global.get_current_time());
            window.raise();
        }
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

    getWindows() {
        return Array.from(this._windows);
    }

    destroy() {
        this._tabs.forEach(tab => tab.destroy());
        this._tabs = [];
        this._windows.clear();
        super.destroy();
    }
});

// Panel button that shows the tab bar in the top panel
const WindowTabsIndicator = GObject.registerClass(
class WindowTabsIndicator extends PanelMenu.Button {
    _init(settings) {
        super._init(0.0, 'Window Tabs');

        this._settings = settings;
        this._tabBar = new WindowTabBar();
        this.add_child(this._tabBar);

        this._windowTracker = Shell.WindowTracker.get_default();
        this._display = global.display;

        // Track window creation
        this._windowCreatedId = this._display.connect('window-created', (display, window) => {
            this._onWindowCreated(window);
        });

        // Track existing windows
        const windows = this._display.get_tab_list(Meta.TabList.NORMAL, null);
        windows.forEach(window => {
            if (this._shouldTrackWindow(window)) {
                this._addWindowToCurrentGroup(window);
            }
        });

        // Focus handling
        this._focusWindowId = global.display.connect('notify::focus-window', () => {
            this._onFocusChanged();
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

        window._unmanageId = window.connect('unmanaged', () => {
            this._onWindowClosed(window);
        });

        // Auto-add new windows to current tab group
        this._addWindowToCurrentGroup(window);
    }

    _addWindowToCurrentGroup(window) {
        this._tabBar.addWindow(window);
    }

    _onWindowClosed(window) {
        if (window._unmanageId) {
            window.disconnect(window._unmanageId);
            window._unmanageId = null;
        }

        const isEmpty = this._tabBar.removeWindow(window);
        // Tab bar is automatically destroyed if empty, but we keep it for new windows
    }

    _onFocusChanged() {
        const focusWindow = global.display.focus_window;
        if (focusWindow && this._shouldTrackWindow(focusWindow)) {
            const windows = this._tabBar.getWindows();
            if (windows.includes(focusWindow)) {
                // Window is already in our tab bar, let it handle activation
                return;
            }
        }
    }

    destroy() {
        if (this._windowCreatedId) {
            this._display.disconnect(this._windowCreatedId);
            this._windowCreatedId = null;
        }

        if (this._focusWindowId) {
            global.display.disconnect(this._focusWindowId);
            this._focusWindowId = null;
        }

        // Clean up window signals
        const windows = this._display.get_tab_list(Meta.TabList.NORMAL, null);
        windows.forEach(window => {
            if (window._unmanageId) {
                window.disconnect(window._unmanageId);
                window._unmanageId = null;
            }
        });

        this._tabBar.destroy();
        super.destroy();
    }
});

export default class WindowTabsExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new WindowTabsIndicator(this._settings);
        Main.panel.addToStatusArea('window-tabs', this._indicator, 0, 'left');
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        this._settings = null;
    }
}
