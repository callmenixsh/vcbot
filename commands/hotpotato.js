const { EmbedBuilder } = require('discord.js');
const hotPotatoes = require('../data/hotPotatoes');

const potatoMessages = [
    "The potato is getting warmer...",
    "The potato is vibrating...",
    "The potato smells dangerous...",
    "The potato is humming softly...",
    "The potato is glowing faintly...",
    "The potato is making concerning noises...",
    "The potato is becoming increasingly angry...",
    "The potato looks unstable...",
    "The potato has started ticking...",
    "Somebody should get rid of that thing..."
];

const dangerMessages = [
    "💥 BOOM!",
    "☠️ DETONATION DETECTED!",
    "🚨 CRITICAL FAILURE!",
    "🔥 POTATO EXPLOSION IMMINENT!",
    "⚠️ CONTAINMENT FAILURE!",
    "☢️ REACTOR MELTDOWN DETECTED!",
    "💣 ARMING SEQUENCE STARTED!",
    "🚨 CORE INSTABILITY DETECTED!"
];


async function updateBoard(game) {

    if (!game?.statusMessage) return;

    const passes =
        game.passes.length > 0
            ? game.passes.map(p => `• ${p}`).join('\n')
            : 'No passes yet';

    const embed = new EmbedBuilder()
        .setTitle(`🥔 Hot Potato | Passes: ${game.passCount}`)
        .addFields(
            {
                name: 'Status',
                value: game.status,
                inline: false
            },
            {
                name: 'Recent Passes',
                value: passes,
                inline: false
            }
        )
        .setFooter({
            text: 'Use !pass @user to survive'
        });      

    await game.statusMessage.edit({
        embeds: [embed]
    }).catch(() => {});
}

module.exports = {
    name: 'hotpotato',
    aliases: ['pass'],

    async execute(message, args = []) {

        if (args[0]?.toLowerCase() === 'pass') {
            args.shift();
        }

        const vc = message.member.voice.channel;
        const target = message.mentions.members.first();

        // =========================
        // PASS
        // =========================

        if (target) {

            if (!vc)
                return message.reply('Join a voice channel first.');

            const game = hotPotatoes.get(vc.id);

            if (!game)
                return message.reply('No potato game running.');

            if (game.holderId !== message.author.id)
                return message.reply('You do not have the potato!');

            if (!vc.members.has(target.id))
                return message.reply('They must be in your VC.');

            if (target.id === message.author.id)
                return message.reply('Nice try 😏');

            // 5% sudden death
            if (Math.random() < 0.05) {

                try {

                    await target.voice.setChannel(null);
                    clearTimeout(game.warningTimeout);
                    hotPotatoes.delete(vc.id);
                    await game.holderMessage
                        ?.delete()
                        .catch(() => {});                    

                    game.status =
                        `💀 ${target.displayName} was vaporized mid-pass!`;

                    await updateBoard(game);

                    clearTimeout(game.warningTimeout);

                    hotPotatoes.delete(vc.id);

                } catch (err) {
                    console.error(err);
                }

                return;
            }

            game.passCount++;

            game.passes.unshift(
                `${message.member.displayName} → ${target.displayName}`
            );

            game.passes = game.passes.slice(0, 5);

            game.holderId = target.id;
            await game.holderMessage.edit(
                `🥔 Holder: <@${target.id}>`
            );            
            game.status = '🥔 The potato changes hands...';

            await updateBoard(game);

            return;
        }

        // =========================
        // START GAME
        // =========================

        if (!vc)
            return message.reply('Join a voice channel first.');

        const players = [...vc.members.values()]
            .filter(m => !m.user.bot);

        if (players.length < 2)
            return message.reply('Need at least 2 players.');

        if (hotPotatoes.has(vc.id))
            return message.reply('A potato game is already running!');

        const holder =
            players[Math.floor(Math.random() * players.length)];

        const explodeTime =
            (Math.floor(Math.random() * 61) + 30) * 1000;

        const embed = new EmbedBuilder()
            .setTitle('🥔 Hot Potato | Passes: 0')
            .addFields(
                {
                    name: 'Status',
                    value: '🥔 The potato seems harmless...',
                    inline: false
                },
                {
                    name: 'Recent Passes',
                    value: 'No passes yet',
                    inline: false
                }
            )
            .setFooter({
                text: 'Use !pass @user to survive'
            });

        const statusMessage =
            await message.channel.send({
                embeds: [embed]
            });

        const holderMessage =
            await message.channel.send(
                `🥔 Holder: <@${holder.id}>`
            );

        hotPotatoes.set(vc.id, {
            holderId: holder.id,
            holderMessage,
            endTime: Date.now() + explodeTime,
            statusMessage,
            status: 'The potato seems harmless...',
            passes: [],
            passCount: 0,
        });

        const game = hotPotatoes.get(vc.id);

const scheduleWarning = async () => {

    const currentGame =
        hotPotatoes.get(vc.id);

    if (!currentGame) return;

    // Fake Explosion
    if (Math.random() < 0.15) {

        const fakeText =
            dangerMessages[
                Math.floor(
                    Math.random() *
                    dangerMessages.length
                )
            ];

        const fakeMsg =
            await message.channel.send(fakeText);

        setTimeout(async () => {

            try {

                await fakeMsg.edit(
                    `${fakeText}\n😏 False alarm.`
                );

                setTimeout(async () => {
                    await fakeMsg.delete().catch(() => {});
                }, 2500);

            } catch {}

        }, 1500);

    } else {

        let newMessage;

        do {
            newMessage =
                potatoMessages[
                    Math.floor(
                        Math.random() *
                        potatoMessages.length
                    )
                ];
        }
        while (
            newMessage === currentGame.status &&
            potatoMessages.length > 1
        );

        currentGame.status = newMessage;

        await updateBoard(currentGame);
    }

    const nextDelay =
        Math.floor(Math.random() * 6000) + 4000;

    currentGame.warningTimeout =
        setTimeout(
            scheduleWarning,
            nextDelay
        );
};

        game.warningTimeout =
            setTimeout(
                scheduleWarning,
                Math.floor(Math.random() * 6000) + 4000
            );

        setTimeout(async () => {

            const game =
                hotPotatoes.get(vc.id);

            if (!game) return;

            clearTimeout(game.warningTimeout);

            // Nuclear potato
            if (Math.random() < 0.01) {

                game.status =
                    '☢️ NUCLEAR POTATO ACTIVATED ☢️';

                await updateBoard(game);

                await message.channel.send(
                    '☢️☢️☢️ NUCLEAR POTATO ACTIVATED ☢️☢️☢️'
                );

                for (const member of vc.members.values()) {

                    if (
                        !member.user.bot &&
                        member.voice.channel
                    ) {
                        try {
                            await member.voice.setChannel(null);
                        } catch {}
                    }
                }

                await game.holderMessage
                ?.delete()
                .catch(() => {});

                game.status =
                    '☢️ Nuclear Potato detonated!';

                await updateBoard(game);
                hotPotatoes.delete(vc.id);
                return;
            }

            const victim =
                vc.members.get(game.holderId);

            if (victim?.voice.channel) {

                try {

                    const warning =
                        dangerMessages[
                            Math.floor(
                                Math.random() *
                                dangerMessages.length
                            )
                        ];

                    await message.channel.send(warning);

                    await new Promise(r =>
                        setTimeout(r, 1500)
                    );

                    await victim.voice.setChannel(null);

                    await game.holderMessage
                        ?.delete()
                        .catch(() => {});

                    game.status =
                        `💥 Potato exploded on ${victim.displayName}!`;

                    await updateBoard(game);

                    await message.channel.send(
                        `🥔 ${victim} was vaporized by the potato.`
                    );

                } catch (err) {
                    console.error(err);
                }
            }

            hotPotatoes.delete(vc.id);

        }, explodeTime);
    }
};