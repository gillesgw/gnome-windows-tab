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
            title: 'Apparence',
            description: 'Personnaliser l\'apparence des onglets de fenêtre',
        });
        page.add(appearanceGroup);

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
        page.add(behaviorGroup);

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

        // Features Group
        const featuresGroup = new Adw.PreferencesGroup({
            title: 'Fonctionnalités',
            description: 'Activer ou désactiver les fonctionnalités',
        });
        page.add(featuresGroup);

        // Info about features
        const featuresInfoRow = new Adw.ActionRow({
            title: 'Fonctionnalités actives',
            subtitle: '• Regroupement automatique par application\n' +
                      '• Onglets sous la barre de titre\n' +
                      '• Drag and drop pour réorganiser\n' +
                      '• Détacher les onglets en fenêtres séparées',
        });
        featuresGroup.add(featuresInfoRow);

        // Keyboard Shortcuts Group
        const shortcutsGroup = new Adw.PreferencesGroup({
            title: 'Raccourcis clavier',
            description: 'Raccourcis pour la navigation entre onglets',
        });
        page.add(shortcutsGroup);

        // Info row
        const shortcutsInfoRow = new Adw.ActionRow({
            title: 'Raccourcis par défaut',
            subtitle: 'Cliquer sur un onglet : Activer la fenêtre\n' +
                      'Bouton × : Fermer l\'onglet\n' +
                      'Bouton + : Nouvelle fenêtre dans le groupe\n' +
                      'Drag and drop : Réorganiser ou détacher les onglets',
        });
        shortcutsGroup.add(shortcutsInfoRow);

        // About Group
        const aboutGroup = new Adw.PreferencesGroup({
            title: 'À propos',
            description: 'Extension Window Tabs',
        });
        page.add(aboutGroup);

        const aboutRow = new Adw.ActionRow({
            title: 'Window Tabs',
            subtitle: 'Onglets de fenêtre style macOS pour GNOME\n' +
                      'Version 1.0 - Réécrit avec architecture native',
        });
        aboutGroup.add(aboutRow);

        const linkRow = new Adw.ActionRow({
            title: 'Page du projet',
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

        const usageGroup = new Adw.PreferencesGroup({
            title: 'Utilisation',
            description: 'Comment utiliser Window Tabs',
        });
        page.add(usageGroup);

        const usageRow = new Adw.ActionRow({
            title: 'Comment ça marche ?',
            subtitle: '1. Ouvrez deux fenêtres de la même application\n' +
                      '2. Les onglets apparaissent automatiquement sous la barre de titre\n' +
                      '3. Cliquez sur un onglet pour basculer entre les fenêtres\n' +
                      '4. Glissez-déposez pour réorganiser ou détacher les onglets',
        });
        usageGroup.add(usageRow);
    }
}
