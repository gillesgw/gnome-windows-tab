import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class WindowTabsPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // Create a preferences page
        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

        // Appearance Group
        const appearanceGroup = new Adw.PreferencesGroup({
            title: 'Appearance',
            description: 'Customize the look of window tabs',
        });
        page.add(appearanceGroup);

        // Tab position
        const positionRow = new Adw.ComboRow({
            title: 'Tab Bar Position',
            subtitle: 'Where to display the tab bar',
            model: new Gtk.StringList({
                strings: ['Top Panel', 'Window Title Bar'],
            }),
        });
        positionRow.set_selected(settings.get_enum('tab-position'));
        positionRow.connect('notify::selected', (widget) => {
            settings.set_enum('tab-position', widget.selected);
        });
        appearanceGroup.add(positionRow);

        // Show app icons
        const showIconsRow = new Adw.SwitchRow({
            title: 'Show Application Icons',
            subtitle: 'Display app icons in tabs',
        });
        settings.bind(
            'show-app-icons',
            showIconsRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        appearanceGroup.add(showIconsRow);

        // Behavior Group
        const behaviorGroup = new Adw.PreferencesGroup({
            title: 'Behavior',
            description: 'Configure tab behavior',
        });
        page.add(behaviorGroup);

        // Auto-group windows
        const autoGroupRow = new Adw.SwitchRow({
            title: 'Auto-group New Windows',
            subtitle: 'Automatically add new windows to the current tab group',
        });
        settings.bind(
            'auto-group-windows',
            autoGroupRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        behaviorGroup.add(autoGroupRow);

        // Close tab behavior
        const closeTabRow = new Adw.ComboRow({
            title: 'When Closing a Tab',
            subtitle: 'What happens when you close a tab',
            model: new Gtk.StringList({
                strings: ['Close Window', 'Minimize Window', 'Remove from Group'],
            }),
        });
        closeTabRow.set_selected(settings.get_enum('close-tab-action'));
        closeTabRow.connect('notify::selected', (widget) => {
            settings.set_enum('close-tab-action', widget.selected);
        });
        behaviorGroup.add(closeTabRow);

        // Keyboard Shortcuts Group
        const shortcutsGroup = new Adw.PreferencesGroup({
            title: 'Keyboard Shortcuts',
            description: 'Keyboard shortcuts for tab navigation',
        });
        page.add(shortcutsGroup);

        // Info row
        const shortcutsInfoRow = new Adw.ActionRow({
            title: 'Default Shortcuts',
            subtitle: 'Ctrl+Tab: Next tab\nCtrl+Shift+Tab: Previous tab\nCtrl+T: New window in group\nCtrl+W: Close current tab',
        });
        shortcutsGroup.add(shortcutsInfoRow);

        // About Group
        const aboutGroup = new Adw.PreferencesGroup({
            title: 'About',
            description: 'Window Tabs Extension',
        });
        page.add(aboutGroup);

        const aboutRow = new Adw.ActionRow({
            title: 'Window Tabs',
            subtitle: 'macOS-style window tabs for GNOME\nVersion 1.0',
        });
        aboutGroup.add(aboutRow);

        const linkRow = new Adw.ActionRow({
            title: 'Project Homepage',
            subtitle: 'https://github.com/gillesgw/gnome-windows-tab',
        });
        linkRow.add_suffix(new Gtk.Image({
            icon_name: 'web-browser-symbolic',
        }));
        linkRow.set_activatable(true);
        linkRow.connect('activated', () => {
            Gtk.show_uri(window, 'https://github.com/gillesgw/gnome-windows-tab', null);
        });
        aboutGroup.add(linkRow);
    }
}
