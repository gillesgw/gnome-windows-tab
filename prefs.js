import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

// Custom row for application selection
const AppRow = GObject.registerClass(
class AppRow extends Adw.ActionRow {
    _init(appInfo, isEnabled, onToggle) {
        super._init({
            title: appInfo.get_display_name(),
            subtitle: appInfo.get_id(),
        });

        this._appId = appInfo.get_id();

        // App icon
        const icon = new Gtk.Image({
            gicon: appInfo.get_icon(),
            pixel_size: 32,
        });
        this.add_prefix(icon);

        // Toggle switch
        this._switch = new Gtk.Switch({
            active: isEnabled,
            valign: Gtk.Align.CENTER,
        });
        this._switch.connect('notify::active', () => {
            onToggle(this._appId, this._switch.get_active());
        });
        this.add_suffix(this._switch);
        this.set_activatable_widget(this._switch);
    }

    get appId() {
        return this._appId;
    }

    setEnabled(enabled) {
        this._switch.set_active(enabled);
    }
});

export default class WindowTabsPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // ===== Applications Page =====
        const appsPage = new Adw.PreferencesPage({
            title: 'Applications',
            icon_name: 'application-x-executable-symbolic',
        });
        window.add(appsPage);

        // Enabled apps group
        const enabledAppsGroup = new Adw.PreferencesGroup({
            title: 'Applications activées',
            description: 'Sélectionnez les applications qui utiliseront les onglets de fenêtre',
        });
        appsPage.add(enabledAppsGroup);

        // Info row
        const infoRow = new Adw.ActionRow({
            title: 'Configuration requise',
            subtitle: 'Seules les applications sélectionnées auront les onglets. Par défaut, aucune application n\'est activée.',
        });
        infoRow.add_prefix(new Gtk.Image({
            icon_name: 'dialog-information-symbolic',
            pixel_size: 24,
        }));
        enabledAppsGroup.add(infoRow);

        // Search entry
        const searchEntry = new Gtk.SearchEntry({
            placeholder_text: 'Rechercher une application...',
            margin_top: 12,
            margin_bottom: 6,
            margin_start: 12,
            margin_end: 12,
        });

        const searchRow = new Adw.PreferencesRow({
            child: searchEntry,
        });
        enabledAppsGroup.add(searchRow);

        // Apps list group
        const appsListGroup = new Adw.PreferencesGroup({
            title: 'Applications disponibles',
        });
        appsPage.add(appsListGroup);

        // Get enabled apps
        let enabledApps = new Set(settings.get_strv('enabled-apps'));

        // Store app rows for filtering
        const appRows = [];

        // Load applications
        const appInfos = Gio.AppInfo.get_all()
            .filter(app => {
                // Only show apps that can open windows
                if (!app.should_show()) return false;
                const id = app.get_id();
                if (!id) return false;
                // Filter out some system apps
                if (id.includes('org.gnome.Settings')) return false;
                if (id.includes('gnome-extensions')) return false;
                return true;
            })
            .sort((a, b) => a.get_display_name().localeCompare(b.get_display_name()));

        // Update settings when an app is toggled
        const onToggle = (appId, enabled) => {
            if (enabled) {
                enabledApps.add(appId);
            } else {
                enabledApps.delete(appId);
            }
            settings.set_strv('enabled-apps', [...enabledApps]);
        };

        // Create rows for each app
        for (const appInfo of appInfos) {
            const appId = appInfo.get_id();
            const isEnabled = enabledApps.has(appId);
            const row = new AppRow(appInfo, isEnabled, onToggle);
            appsListGroup.add(row);
            appRows.push({
                row,
                appId,
                name: appInfo.get_display_name().toLowerCase(),
            });
        }

        // Search filter
        searchEntry.connect('search-changed', () => {
            const query = searchEntry.get_text().toLowerCase();
            for (const {row, name, appId} of appRows) {
                const visible = name.includes(query) || appId.toLowerCase().includes(query);
                row.set_visible(visible);
            }
        });

        // Listen for external settings changes
        settings.connect('changed::enabled-apps', () => {
            enabledApps = new Set(settings.get_strv('enabled-apps'));
            for (const {row, appId} of appRows) {
                row.setEnabled(enabledApps.has(appId));
            }
        });

        // ===== Settings Page =====
        const settingsPage = new Adw.PreferencesPage({
            title: 'Paramètres',
            icon_name: 'preferences-system-symbolic',
        });
        window.add(settingsPage);

        // Appearance Group
        const appearanceGroup = new Adw.PreferencesGroup({
            title: 'Apparence',
            description: 'Personnaliser l\'apparence des onglets de fenêtre',
        });
        settingsPage.add(appearanceGroup);

        // Show app icons
        const showIconsRow = new Adw.SwitchRow({
            title: 'Afficher les icônes d\'application',
            subtitle: 'Afficher les icônes des applications dans les onglets',
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
            title: 'Comportement',
            description: 'Configurer le comportement des onglets',
        });
        settingsPage.add(behaviorGroup);

        // Auto-group windows
        const autoGroupRow = new Adw.SwitchRow({
            title: 'Regroupement automatique',
            subtitle: 'Grouper automatiquement les fenêtres de la même application',
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
            title: 'Action lors de la fermeture d\'un onglet',
            subtitle: 'Que se passe-t-il lorsque vous fermez un onglet',
            model: new Gtk.StringList({
                strings: ['Fermer la fenêtre', 'Minimiser la fenêtre', 'Retirer du groupe'],
            }),
        });
        closeTabRow.set_selected(settings.get_enum('close-tab-action'));
        closeTabRow.connect('notify::selected', (widget) => {
            settings.set_enum('close-tab-action', widget.selected);
        });
        behaviorGroup.add(closeTabRow);

        // Max tabs per group
        const maxTabsRow = new Adw.SpinRow({
            title: 'Nombre maximum d\'onglets par groupe',
            subtitle: 'Limite le nombre d\'onglets dans un groupe',
            adjustment: new Gtk.Adjustment({
                lower: 2,
                upper: 20,
                step_increment: 1,
                page_increment: 5,
                value: settings.get_int('max-tabs-per-group'),
            }),
        });
        maxTabsRow.connect('changed', (widget) => {
            settings.set_int('max-tabs-per-group', widget.get_value());
        });
        behaviorGroup.add(maxTabsRow);

        // ===== About Page =====
        const aboutPage = new Adw.PreferencesPage({
            title: 'À propos',
            icon_name: 'help-about-symbolic',
        });
        window.add(aboutPage);

        // About Group
        const aboutGroup = new Adw.PreferencesGroup({
            title: 'Window Tabs',
            description: 'Onglets de fenêtre style macOS pour GNOME',
        });
        aboutPage.add(aboutGroup);

        const versionRow = new Adw.ActionRow({
            title: 'Version',
            subtitle: '1.0',
        });
        aboutGroup.add(versionRow);

        // Usage Group
        const usageGroup = new Adw.PreferencesGroup({
            title: 'Utilisation',
            description: 'Comment utiliser Window Tabs',
        });
        aboutPage.add(usageGroup);

        const usageRow = new Adw.ActionRow({
            title: 'Comment ça marche ?',
            subtitle: '1. Activez les applications dans l\'onglet "Applications"\n' +
                      '2. Ouvrez deux fenêtres de la même application\n' +
                      '3. Les onglets apparaissent automatiquement au-dessus de la fenêtre\n' +
                      '4. Cliquez sur un onglet pour basculer entre les fenêtres\n' +
                      '5. Utilisez le bouton de dégroupement pour séparer un onglet',
        });
        usageGroup.add(usageRow);

        const shortcutsGroup = new Adw.PreferencesGroup({
            title: 'Actions',
            description: 'Boutons disponibles sur chaque onglet',
        });
        aboutPage.add(shortcutsGroup);

        const shortcutsRow = new Adw.ActionRow({
            title: 'Boutons des onglets',
            subtitle: '• Clic sur l\'onglet : Activer la fenêtre\n' +
                      '• Icône fenêtre : Dégrouper l\'onglet\n' +
                      '• Bouton × : Fermer la fenêtre\n' +
                      '• Bouton + : Nouvelle fenêtre dans le groupe',
        });
        shortcutsGroup.add(shortcutsRow);
    }
}
