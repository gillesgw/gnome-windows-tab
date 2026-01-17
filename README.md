# Window Tabs - GNOME Shell Extension

Apportez le concept d'onglets de fenêtre de macOS à GNOME Shell. Organisez plusieurs fenêtres en onglets pour un flux de travail plus efficace.

## Fonctionnalités

- **Onglets de fenêtre**: Regroupez plusieurs fenêtres dans une barre d'onglets comme macOS
- **Barre d'onglets dans le panneau supérieur**: Accès facile aux onglets depuis le panneau GNOME
- **Icônes d'application**: Identifiez rapidement les fenêtres avec leurs icônes
- **Basculement entre onglets**: Cliquez sur un onglet pour activer la fenêtre correspondante
- **Bouton de fermeture**: Fermez les onglets individuellement
- **Nouvelle fenêtre**: Créez une nouvelle fenêtre dans le groupe actuel
- **Gestion automatique**: Les nouvelles fenêtres sont automatiquement ajoutées au groupe d'onglets
- **Interface élégante**: Design moderne avec animations fluides

## Captures d'écran

La barre d'onglets apparaît dans le panneau supérieur de GNOME et affiche tous les onglets de fenêtre actifs avec:
- Icônes d'application
- Titres de fenêtre
- Indicateur d'onglet actif
- Boutons de fermeture
- Bouton "nouvelle fenêtre"

## Installation

### Installation manuelle

1. Clonez ce dépôt:
```bash
git clone https://github.com/gillesgw/gnome-windows-tab.git
cd gnome-windows-tab
```

2. Copiez l'extension dans le répertoire des extensions GNOME:
```bash
mkdir -p ~/.local/share/gnome-shell/extensions/window-tabs@gnome-shell-extensions
cp -r * ~/.local/share/gnome-shell/extensions/window-tabs@gnome-shell-extensions/
```

3. Compilez le schéma GSettings:
```bash
cd ~/.local/share/gnome-shell/extensions/window-tabs@gnome-shell-extensions
glib-compile-schemas schemas/
```

4. Redémarrez GNOME Shell:
   - Sur X11: Appuyez sur `Alt+F2`, tapez `r`, puis Entrée
   - Sur Wayland: Déconnectez-vous et reconnectez-vous

5. Activez l'extension:
```bash
gnome-extensions enable window-tabs@gnome-shell-extensions
```

Ou utilisez l'application "Extensions" de GNOME.

## Utilisation

### Fonctionnement de base

1. **Affichage des onglets**: Une fois activée, l'extension affiche une barre d'onglets dans le panneau supérieur gauche
2. **Basculer entre fenêtres**: Cliquez sur un onglet pour activer la fenêtre correspondante
3. **Nouvelle fenêtre**: Cliquez sur le bouton "+" pour ouvrir une nouvelle fenêtre de l'application actuelle
4. **Fermer un onglet**: Cliquez sur le "×" d'un onglet pour fermer la fenêtre

### Raccourcis clavier (prévus)

- `Ctrl+Tab`: Onglet suivant
- `Ctrl+Shift+Tab`: Onglet précédent
- `Ctrl+T`: Nouvelle fenêtre dans le groupe
- `Ctrl+W`: Fermer l'onglet actuel

## Configuration

Accédez aux préférences via l'application "Extensions" de GNOME:

### Apparence
- **Position de la barre d'onglets**: Panneau supérieur ou barre de titre de fenêtre
- **Afficher les icônes d'application**: Activer/désactiver les icônes dans les onglets

### Comportement
- **Regroupement automatique**: Ajouter automatiquement les nouvelles fenêtres au groupe actuel
- **Action de fermeture d'onglet**: Choisir ce qui se passe lors de la fermeture d'un onglet
  - Fermer la fenêtre
  - Minimiser la fenêtre
  - Retirer du groupe

## Architecture technique

### Fichiers principaux

- `extension.js`: Logique principale de l'extension
  - `WindowTab`: Bouton d'onglet représentant une fenêtre
  - `WindowTabBar`: Conteneur de barre d'onglets
  - `WindowTabsIndicator`: Indicateur du panneau GNOME
- `prefs.js`: Interface de préférences
- `stylesheet.css`: Styles CSS pour l'interface
- `metadata.json`: Métadonnées de l'extension
- `schemas/`: Schémas GSettings pour la configuration

### Technologies utilisées

- **GNOME Shell**: Framework d'extension
- **GJS**: JavaScript bindings pour GNOME
- **St (Shell Toolkit)**: Widgets d'interface
- **Clutter**: Graphisme et animations
- **Meta**: Gestion des fenêtres
- **GSettings**: Système de configuration

## Compatibilité

- GNOME Shell 45+
- GNOME Shell 46+

Testé sur:
- Fedora 39+ avec GNOME 45
- Ubuntu 24.04+ avec GNOME 46

## Développement

### Structure du projet

```
gnome-windows-tab/
├── extension.js          # Code principal
├── prefs.js             # Préférences
├── stylesheet.css       # Styles
├── metadata.json        # Métadonnées
├── schemas/
│   └── org.gnome.shell.extensions.window-tabs.gschema.xml
└── README.md
```

### Développement local

Pour tester les modifications:

```bash
# Copier les fichiers modifiés
cp -r * ~/.local/share/gnome-shell/extensions/window-tabs@gnome-shell-extensions/

# Recompiler les schémas si nécessaire
cd ~/.local/share/gnome-shell/extensions/window-tabs@gnome-shell-extensions
glib-compile-schemas schemas/

# Redémarrer GNOME Shell (X11)
Alt+F2, puis 'r'

# Voir les logs
journalctl -f -o cat /usr/bin/gnome-shell
```

## Fonctionnalités à venir

- Glisser-déposer pour réorganiser les onglets
- Groupes de fenêtres multiples
- Persistance des groupes entre sessions
- Support des raccourcis clavier personnalisables
- Thèmes d'onglets
- Mode onglet dans la barre de titre de fenêtre

## Contribution

Les contributions sont les bienvenues ! N'hésitez pas à:

1. Forker le projet
2. Créer une branche pour votre fonctionnalité (`git checkout -b feature/AmazingFeature`)
3. Commiter vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Pusher vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## Problèmes connus

- Sur Wayland, le redémarrage de GNOME Shell nécessite une déconnexion/reconnexion
- Les fenêtres minimisées peuvent ne pas apparaître immédiatement dans les onglets

## Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## Auteur

Développé avec ❤️ pour la communauté GNOME

## Liens

- **GitHub**: https://github.com/gillesgw/gnome-windows-tab
- **Issues**: https://github.com/gillesgw/gnome-windows-tab/issues
- **GNOME Extensions**: https://extensions.gnome.org/

## Remerciements

Inspiré par le système d'onglets de fenêtre de macOS et créé pour améliorer le flux de travail sur GNOME.
