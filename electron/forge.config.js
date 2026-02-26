module.exports = {
    packagerConfig: {
        name: 'TheJoker',
        executableName: 'TheJoker',
        asar: true,
        icon: './assets/icon',
        extraResource: [
            '../dist',
            '../node_modules',
            '../package.json',
        ],
    },
    makers: [
        {
            name: '@electron-forge/maker-squirrel',
            config: {
                name: 'TheJoker',
                setupIcon: './assets/icon.ico',
                description: 'The Joker - Premium AI Desktop Terminal',
            },
        },
        {
            name: '@electron-forge/maker-zip',
            platforms: ['win32'],
        },
    ],
};
