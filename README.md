# one.filer

## Documentation

> [The updated documentation can be found here](https://docs.google.com/document/d/1k6_TkA0X1mihO3RhXwpIUKtME3USr-vvipTwxfnmi-0/edit)

The old document can be
found [here](https://docs.google.com/document/d/1E8MKGX0jGYLCuHCfVARu-tgkw8p4ovXk6w69bZ0HPrI/edit#)

## Installation

- Download and install
    - [node.js](https://nodejs.org/en/download/current/)
    - [git](https://git-scm.com/downloads)
- A GitHub account authenticated with an ssh key pair
- Access to
    - github.com/refinio/one.core
    - github.com/refinio/one.models

**The original instructions used yarn, but npm works too of course.**

### For Windows

In case pthreads installation with vcpkg shows error about not finding visual studio instance, download `C++ CMake tools for Windows` individual component from https://visualstudio.microsoft.com/downloads/ community visual studio installer.

Python is required. Tested with version 3.*

- Get WinFSP from [here](https://github.com/winfsp/winfsp/releases/tag/v1.8) (the .msi file) and 
  install it. In the installation prompt, enable Core & Development Features
- `npm install` (in one.filer)
- `npm run build`
- `npm run start-filer`

### For Linux

- `npm install -g fuse-native`
- make node, npm and fuse-native available for sudo
    - `sudo ln -s /home/ubuntu/.nvm/versions/node/v16.18.0/bin/node /usr/local/bin/node`
    - `sudo ln -s /home/ubuntu/.nvm/versions/node/v16.18.0/bin/npm /usr/local/bin/npm`
    - `sudo ln -s /home/ubuntu/.nvm/versions/node/v16.18.0/bin/fuse-native /usr/local/bin/fuse-native`
- `fuse-native is-configured` # checks if the kernel extension is already configured
- `sudo fuse-native configure` # configures the kernel extension
- `npm install`
- `npm run build`
- `npm run start`

Another document says

- `npm install -g fuse-native`
- `fuse-native is-configured` # checks if the kernel extension is already configured
- `fuse-native configure` # configures the kernel extension
- `npm install`
- `npm run build`
- `npm run start`

### For macOS

- `npm install`
- `npm run build`
- `npm run start`

## Misc

I added a lsone.sh file. It lists the contents of the one datbase in human-readable format.
Requirements: bash, sed and tidy and a console that understands ansi colors.

### Using `npm link`

To use one.core or one.models from another GitHub clone location during development:

(Erik)

Schritt 1:
- Libs klonen (Libs für npm link hab ich aktuell in den Unterordner linked gepackt - 
nicht sicher ob das eine Kluge Idee ist)
- one.core irgendwohin klonen und auf branch "crdt_fix" wechseln
- one.models irgendwohin klonen und auf branch  "filer_model" wechseln

Schritt 2: Filer linken
> npm link ../linked/one.core  ../linked/one.models

Schritt 3: one.models mit one.core verlinken (sonst verwendet models eine eigene core Version)
> cd ../linked/one.models
> npm link ../one.core

Und solang du nirgends ein npm install machst, sollte der die Links beibehalten. Bei einem `npm 
install` macht der wieer alles rückgängig, außer du speicherst die Verlinkung in der package.json 
mit `--save` bei `npm link` oder nur in der `package-lock.json` (hab das Argument vergessen)

Wieso erst das Projekt und dann die libs untereinander linken? Weil der `npm link` im Hauptprojekt 
one.models und one.core gleichzeitig baut => der one.core/lib Ordner existiert dann nicht 
während one.models baut, weil das parallel passiert (völlig banane). Und man kann in Schritt 2 
auch nicht

> npm link ../linked/one.core
> npm link ../linked/one.models

machen, da das zweite npm link das erste überschreibt ...

> npm ls --link

sagt dir was aktuell verlinkt ist - oder man macht

> ls -l node_modules/\@refinio

dann sieht man auch ob da symlinks sind, oder nicht.
