# Window Tabs - Extension GNOME Shell

Apportez le concept d'onglets de fenêtre de macOS à GNOME Shell. Les fenêtres de la même application se regroupent automatiquement en onglets qui apparaissent directement sous la barre de titre de la fenêtre.

## 🎯 Fonctionnalités principales

- **Onglets intégrés aux fenêtres**: Les onglets apparaissent directement sous la barre de titre de chaque application
- **Regroupement automatique**: Dès que vous ouvrez une deuxième fenêtre d'une application, les onglets s'affichent automatiquement
- **Interface native**: S'intègre parfaitement à GNOME et fonctionne avec n'importe quelle application
- **Drag and drop**: Glissez-déposez les onglets pour les réorganiser ou les détacher
- **Détacher/Attacher**: Séparez un onglet en fenêtre indépendante ou regroupez des fenêtres
- **Basculement intuitif**: Cliquez sur un onglet pour activer instantanément la fenêtre correspondante
- **Bouton de fermeture**: Fermez des onglets individuellement
- **Nouvelle fenêtre**: Créez rapidement une nouvelle fenêtre dans le groupe actuel
- **Icônes d'application**: Identifiez rapidement vos fenêtres
- **Design moderne**: Interface élégante avec animations fluides

## 🖼️ Comment ça marche

### Comportement automatique

1. Vous avez **une seule fenêtre** d'une application → Pas d'onglets visibles (comportement normal)
2. Vous ouvrez une **deuxième fenêtre** de la même application → **Les onglets apparaissent automatiquement** sous la barre de titre !
3. Cliquez sur un onglet pour basculer entre les fenêtres
4. Fermez des fenêtres et quand il n'en reste qu'une, les onglets disparaissent automatiquement

### Exemple concret

```
Vous ouvrez Firefox → une fenêtre normale
Vous ouvrez une 2e fenêtre Firefox → BAM ! Une barre d'onglets apparaît sous la barre de titre
Les deux fenêtres sont maintenant groupées, vous pouvez basculer entre elles via les onglets
```

## 📸 Interface

La barre d'onglets apparaît sous la barre de titre et contient :
- **Icônes d'application** pour identification rapide
- **Titres de fenêtre** tronqués pour économiser l'espace
- **Indicateur visuel** pour l'onglet actif (surbrillance bleue)
- **Boutons de fermeture (×)** sur chaque onglet
- **Bouton nouvelle fenêtre (+)** pour créer une fenêtre dans le groupe

## 🚀 Installation

### Installation manuelle

1. Clonez ce dépôt :
```bash
git clone https://github.com/gillesgw/gnome-windows-tab.git
cd gnome-windows-tab
```

2. Copiez l'extension dans le répertoire des extensions GNOME :
```bash
mkdir -p ~/.local/share/gnome-shell/extensions/window-tabs@gnome-shell-extensions
cp -r * ~/.local/share/gnome-shell/extensions/window-tabs@gnome-shell-extensions/
```

3. Compilez le schéma GSettings :
```bash
cd ~/.local/share/gnome-shell/extensions/window-tabs@gnome-shell-extensions
glib-compile-schemas schemas/
```

4. Redémarrez GNOME Shell :
   - Sur **X11**: Appuyez sur `Alt+F2`, tapez `r`, puis Entrée
   - Sur **Wayland**: Déconnectez-vous et reconnectez-vous

5. Activez l'extension :
```bash
gnome-extensions enable window-tabs@gnome-shell-extensions
```

Ou utilisez l'application **Extensions** de GNOME.

## 💡 Utilisation

### Fonctionnement de base

| Action | Résultat |
|--------|----------|
| Ouvrir 2+ fenêtres de la même app | Les onglets apparaissent automatiquement |
| Cliquer sur un onglet | Active la fenêtre correspondante |
| Cliquer sur × | Ferme la fenêtre/onglet |
| Cliquer sur + | Ouvre une nouvelle fenêtre dans le groupe |
| Glisser un onglet ailleurs | Détache l'onglet en fenêtre séparée |
| Glisser un onglet sur un autre | Réorganise les onglets |

### Détacher et attacher des onglets

**Détacher un onglet** :
- Glissez un onglet en dehors de la barre d'onglets
- La fenêtre devient indépendante et perd ses onglets (jusqu'à ce qu'une autre fenêtre de la même app soit ouverte)

**Attacher des fenêtres** :
- Les fenêtres de la même application se regroupent **automatiquement**
- Aucune action manuelle nécessaire !

### Exemples d'utilisation

**Développement web** :
```
Firefox fenêtre 1 : Documentation
Firefox fenêtre 2 : Application web en dev
Firefox fenêtre 3 : Console d'admin
→ Basculez facilement entre vos 3 contextes via les onglets !
```

**Édition de documents** :
```
LibreOffice Writer document 1 : Chapitre 1
LibreOffice Writer document 2 : Chapitre 2
→ Passez d'un chapitre à l'autre sans chercher dans la vue d'ensemble
```

## ⚙️ Configuration

Accédez aux préférences via l'application **Extensions** de GNOME :

### Apparence
- **Afficher les icônes d'application** : Activer/désactiver les icônes dans les onglets

### Comportement
- **Regroupement automatique** : Grouper automatiquement les nouvelles fenêtres (recommandé : activé)
- **Action de fermeture d'onglet** : Choisir ce qui se passe lors de la fermeture
  - Fermer la fenêtre (par défaut)
  - Minimiser la fenêtre
  - Retirer du groupe
- **Nombre maximum d'onglets** : Limite du nombre d'onglets par groupe (2-20)

## 🏗️ Architecture technique

### Composants principaux

**WindowTab** (extension.js:17-177)
- Représente un onglet individuel
- Support du drag and drop natif
- Gère les événements click, fermeture, détachement

**TabBarOverlay** (extension.js:180-344)
- Barre d'onglets positionnée sous la barre de titre
- Utilise `Main.layoutManager.addChrome()` pour l'overlay
- Scroll horizontal automatique si trop d'onglets
- Apparaît/disparaît automatiquement selon le nombre de fenêtres

**WindowTabGroup** (extension.js:347-516)
- Gère un groupe de fenêtres d'une même application
- Synchronise l'affichage/masquage des fenêtres
- Suit les mouvements et redimensionnements de fenêtre
- Positionne dynamiquement la barre d'onglets

**WindowTabsManager** (extension.js:519-615)
- Gestionnaire principal qui surveille toutes les fenêtres
- Crée automatiquement des groupes par application
- Nettoie les groupes vides

### Technologies utilisées

- **GNOME Shell**: Framework d'extension
- **GJS**: JavaScript bindings pour GNOME
- **St (Shell Toolkit)**: Widgets d'interface
- **Clutter**: Graphisme et animations
- **Meta**: Gestion des fenêtres (Meta.Window)
- **Shell.WindowTracker**: Suivi des applications
- **DND (Drag and Drop)**: Système de glisser-déposer natif
- **GSettings**: Configuration persistante

### Positionnement des onglets

L'extension utilise une technique d'**overlay** pour positionner les onglets :

1. Chaque groupe crée une `TabBarOverlay` ajoutée via `Main.layoutManager.addChrome()`
2. L'overlay est positionnée dynamiquement juste sous la barre de titre de la fenêtre active
3. Les signaux `size-changed` et `position-changed` maintiennent la synchronisation
4. L'overlay apparaît/disparaît automatiquement selon le nombre de fenêtres dans le groupe

## 🎨 Styles et thèmes

L'extension utilise un style moderne qui s'intègre à GNOME :

- **Onglets inactifs** : Gris foncé avec transparence
- **Onglet actif** : Dégradé bleu (couleur accent de GNOME)
- **Hover** : Éclaircissement subtil
- **Animations** : Transitions fluides de 150ms
- **Ombres** : Ombres portées pour la profondeur

Vous pouvez personnaliser les styles en modifiant `stylesheet.css`.

## 🔧 Développement

### Structure du projet

```
gnome-windows-tab/
├── extension.js          # Code principal (630 lignes)
│   ├── WindowTab         # Onglet avec drag and drop
│   ├── TabBarOverlay     # Barre d'onglets en overlay
│   ├── WindowTabGroup    # Groupe de fenêtres
│   └── WindowTabsManager # Gestionnaire principal
├── prefs.js             # Interface de préférences
├── stylesheet.css       # Styles CSS (215 lignes)
├── metadata.json        # Métadonnées
├── schemas/
│   └── org.gnome.shell.extensions.window-tabs.gschema.xml
├── README.md
├── LICENSE
└── .gitignore
```

### Tests locaux

Pour tester les modifications :

```bash
# Copier les fichiers modifiés
cp -r * ~/.local/share/gnome-shell/extensions/window-tabs@gnome-shell-extensions/

# Recompiler les schémas
cd ~/.local/share/gnome-shell/extensions/window-tabs@gnome-shell-extensions
glib-compile-schemas schemas/

# Redémarrer GNOME Shell
# X11 : Alt+F2, puis 'r'
# Wayland : déconnexion/reconnexion

# Voir les logs en temps réel
journalctl -f -o cat /usr/bin/gnome-shell
```

### Debugging

```bash
# Logs GNOME Shell
journalctl -f -o cat /usr/bin/gnome-shell | grep -i "window.*tab"

# Activer le mode debug
dconf write /org/gnome/shell/extensions/window-tabs/debug true

# Looking Glass (Alt+F2, puis 'lg')
# Inspectez les objets en temps réel
```

## 🚧 Fonctionnalités à venir

- [ ] Raccourcis clavier personnalisables (Ctrl+Tab, etc.)
- [ ] Réorganisation des onglets par drag and drop sur la même barre
- [ ] Groupes de fenêtres multiples pour une même application
- [ ] Persistance des groupes entre sessions
- [ ] Animation lors du détachement d'onglet
- [ ] Thèmes d'onglets personnalisables
- [ ] Support de l'historique de navigation entre onglets
- [ ] Aperçu (preview) au survol d'un onglet
- [ ] Onglets épinglés

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :

1. Forker le projet
2. Créer une branche pour votre fonctionnalité (`git checkout -b feature/IncroyableFonctionnalite`)
3. Commiter vos changements (`git commit -m 'Ajout d'une fonctionnalité incroyable'`)
4. Pusher vers la branche (`git push origin feature/IncroyableFonctionnalite`)
5. Ouvrir une Pull Request

### Guidelines de contribution

- Respectez le style de code existant
- Testez sur GNOME 45 et 46
- Documentez les nouvelles fonctionnalités
- Utilisez des messages de commit clairs

## 📋 Problèmes connus

- **Wayland** : Le redémarrage de GNOME Shell nécessite une déconnexion/reconnexion
- **Fenêtres minimisées** : Les fenêtres minimisées peuvent ne pas apparaître immédiatement dans les onglets
- **Performance** : Avec beaucoup de fenêtres (15+), léger délai de positionnement
- **Décoration native** : Les onglets sont en overlay, pas intégrés à la décoration de fenêtre native

## 🔒 Compatibilité

- **GNOME Shell** : 45+, 46+
- **Testé sur** :
  - Fedora 39-40 avec GNOME 45-46
  - Ubuntu 24.04+ avec GNOME 46
  - Arch Linux avec GNOME 46
- **Protocoles** : X11 et Wayland
- **Applications** : Toutes les applications GNOME natives et la plupart des apps tierces

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 👨‍💻 Auteur

Développé avec ❤️ pour la communauté GNOME

Architecture entièrement réécrite pour une intégration native avec GNOME Shell.

## 🔗 Liens

- **GitHub** : https://github.com/gillesgw/gnome-windows-tab
- **Issues** : https://github.com/gillesgw/gnome-windows-tab/issues
- **GNOME Extensions** : https://extensions.gnome.org/ (bientôt disponible)

## 🙏 Remerciements

Inspiré par :
- Le système d'onglets de fenêtre de **macOS**
- Les extensions GNOME existantes : **Unite**, **Dash to Panel**
- La communauté **GNOME Shell** pour la documentation et les exemples

---

**Note** : Cette extension a été complètement réécrite avec une architecture native qui intègre les onglets directement aux fenêtres d'application, reproduisant fidèlement l'expérience macOS tout en respectant les paradigmes de GNOME.
