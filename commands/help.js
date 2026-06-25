const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',

    async execute(message) {

        const embed = new EmbedBuilder()
            .setTitle('📖 Commands List')
            .setColor('Red')
            .addFields(
                {
                    name: '🥔 Hot Potato',
                    value:
                        '`nya!hotpotato` Start a Hot Potato game\n' +
                        '`!pass @user` Pass the potato',
                },
                {
                    name: '🎲 VC Roulette',
                    value:
                        '`nya!roulette` Start a turn-based VC roulette game\n'
                },
                {
                    name: '💨 VC Yeet',
                    value:
                        '`nya!yeet @user [seconds]` Kick a user after delay\n' +
                        '`nya!yeetall [seconds]` Kick EVERYONE in VC after delay',
                },
                {
                    name: '📖 Help',
                    value:
                        '`nya!help` Show this menu',
                }
            )
            .setFooter({
                text: 'Gimme more ideas'
            });

        await message.channel.send({
            embeds: [embed]
        });
    }
};