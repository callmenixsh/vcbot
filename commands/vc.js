const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
} = require("discord.js");
const { joinVoiceChannel, getVoiceConnection } = require("@discordjs/voice");
const { safeEdit } = require("../utils/safeEdit");

let sleepTimers = [];
let sleepMessages = [];

function parseTime(input) {
  if (!input) return 10000;
  if (/^\d+$/.test(input)) return parseInt(input, 10) * 1000;

  let ms = 0;
  for (const match of input.matchAll(/(\d+)([smh])/gi)) {
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (unit === "s") ms += value * 1000;
    if (unit === "m") ms += value * 60000;
    if (unit === "h") ms += value * 3600000;
  }
  return ms || 10000;
}

function clockTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function contextFrom(source) {
  const isInteraction = Boolean(source.user);

  if (isInteraction) {
    return {
      channel: source.channel,
      guild: source.guild,
      member: source.member,
      authorId: source.user.id,
      reply: (payload) => {
        const data = typeof payload === "string" ? { content: payload, ephemeral: true } : payload;
        return source.replied || source.deferred ? source.followUp(data) : source.reply(data);
      },
    };
  }

  return {
    channel: source.channel,
    guild: source.guild,
    member: source.member,
    authorId: source.author.id,
    reply: (payload) => source.reply(payload),
  };
}

const ACTIONS = {
  disconnect: {
    title: "Disconnect",
    verb: "disconnect",
    emoji: "👟",
    action: (m) => m.voice.setChannel(null),
    singleDone: (m) => `${m} has been disconnected.`,
    massDone: (u) => `Disconnected:\n${u}`,
  },
  deafen: {
    title: "Voice Deafen",
    verb: "deafen",
    emoji: "🔇",
    action: (m) => m.voice.setDeaf(true),
    singleDone: (m) => `${m} has been server deafened.`,
    massDone: (u) => `Server deafened:\n${u}`,
  },
  undeafen: {
    title: "Voice Undeafen",
    verb: "undeafen",
    emoji: "🔊",
    action: (m) => m.voice.setDeaf(false),
    singleDone: (m) => `${m} has been server undeafened.`,
    massDone: (u) => `Server undeafened:\n${u}`,
  },
  mute: {
    title: "Voice Mute",
    verb: "server mute",
    emoji: "🔕",
    action: (m) => m.voice.setMute(true),
    singleDone: (m) => `${m} has been server muted.`,
    massDone: (u) => `Server muted:\n${u}`,
  },
  unmute: {
    title: "Voice Unmute",
    verb: "server unmute",
    emoji: "🔔",
    action: (m) => m.voice.setMute(false),
    singleDone: (m) => `${m} has been server unmuted.`,
    massDone: (u) => `Server unmuted:\n${u}`,
  },
};

async function scheduleSingleAction(ctx, { member, delayMs, title, verb, emoji, action, cancelId, completedText }) {
  const end = Math.floor((Date.now() + delayMs) / 1000);

  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle(`${emoji} ${title}`)
    .setDescription(`Understood, I'll **${verb}**\n${member}\n<t:${end}:R>`)
    .setFooter({ text: `At ${clockTime(new Date(Date.now() + delayMs))}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(cancelId).setLabel("Cancel").setEmoji("❌").setStyle(ButtonStyle.Secondary)
  );

  const msg = await ctx.channel.send({ embeds: [embed], components: [row] });
  let cancelled = false;

  const timeout = setTimeout(async () => {
    if (cancelled) return;

    try {
      if (member.voice.channel) await action(member);
    } catch (err) {
      console.error("vc single-action error:", err);
    }

    if (!msg.editable) return;
    await safeEdit(msg, {
      embeds: [
        new EmbedBuilder()
          .setColor("Red")
          .setTitle(`${emoji} ${title} Complete`)
          .setDescription(completedText(member) + `\n<t:${Math.floor(Date.now() / 1000)}:R>`)
          .setFooter({ text: `At ${clockTime()}` }),
      ],
      components: [],
    });
  }, delayMs);

  const collector = msg.createMessageComponentCollector({ time: delayMs });

  collector.on("collect", async (i) => {
    if (i.user.id !== ctx.authorId) {
      return i.reply({ content: "Only the command author can cancel this.", ephemeral: true });
    }

    cancelled = true;
    clearTimeout(timeout);

    await i.update({
      embeds: [
        new EmbedBuilder()
          .setColor("Green")
          .setTitle(`✔️ ${title} Cancelled`)
          .setDescription(`🕊️ ${member} has been spared.`),
      ],
      components: [],
    });

    collector.stop();
  });
}

async function scheduleMassAction(ctx, { members, delayMs, title, verb, emoji, completeText, action, cancelId, isSleep = false }) {
  const end = Math.floor((Date.now() + delayMs) / 1000);
  const targetList = members.slice(0, 10).map((m) => `${m}`).join(", ");
  const extra = members.length > 10 ? `\n+${members.length - 10} more` : "";

  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle(`${emoji} ${title}`)
    .setDescription(`Understood, I'll **${verb}**\n${targetList}${extra}\n<t:${end}:R>`)
    .setFooter({ text: `At ${clockTime(new Date(Date.now() + delayMs))}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(cancelId).setLabel("Cancel").setEmoji("❌").setStyle(ButtonStyle.Secondary)
  );

  const msg = await ctx.channel.send({ embeds: [embed], components: [row] });
  if (isSleep) sleepMessages.push(msg);

  let cancelled = false;

  const timeout = setTimeout(async () => {
    if (cancelled) return;

    const affected = [];
    for (const member of members) {
      try {
        if (!member.voice.channel) continue;
        await action(member);
        affected.push(member);
      } catch (err) {
        console.error("vc mass-action error:", err);
      }
    }

    if (!msg.editable) return;
    await safeEdit(msg, {
      embeds: [
        new EmbedBuilder()
          .setColor("Red")
          .setTitle(`${emoji} ${title} Complete`)
          .setDescription(completeText(affected.length ? affected.join(", ") : "Nobody"))
          .setFooter({ text: `At ${clockTime()}` }),
      ],
      components: [],
    });
  }, delayMs);

  if (isSleep) sleepTimers.push(timeout);

  const collector = msg.createMessageComponentCollector({ time: delayMs });

  collector.on("collect", async (i) => {
    if (i.user.id !== ctx.authorId) {
      return i.reply({ content: "Only the command author can cancel this.", ephemeral: true });
    }

    cancelled = true;
    clearTimeout(timeout);

    await i.update({
      embeds: [
        new EmbedBuilder()
          .setColor("Green")
          .setTitle(`✔️ ${title} Cancelled`)
          .setDescription("🕊️ Everyone has been spared."),
      ],
      components: [],
    });

    collector.stop();
  });
}

async function scheduleSleep(ctx, vc) {
  const members = [...vc.members.values()].filter((m) => !m.user.bot);
  if (!members.length) return;

  sleepMessages.push(await ctx.channel.send("🌙 Good night <3\n \n - - - - - - - - ‎ "));

  await scheduleMassAction(ctx, {
    members,
    delayMs: 30 * 60 * 1000,
    title: "Sleep - Deafen",
    verb: "deafen",
    emoji: "🌙",
    completeText: (u) => `Deafened:\n${u}`,
    action: (m) => m.voice.setDeaf(true),
    cancelId: "cancel_sleep_deafen",
    isSleep: true,
  });

  scheduleMassAction(ctx, {
    members,
    delayMs: 1 * 60 * 60 * 1000,
    title: "Sleep - Disconnect",
    verb: "disconnect",
    emoji: "👟",
    completeText: (u) => `Disconnected:\n${u}`,
    action: (m) => m.voice.setChannel(null),
    cancelId: "cancel_sleep_disconnect",
    isSleep: true,
  });

  sleepMessages.push(await ctx.channel.send("- - - - - - - - ‎ \n \n I will sleep <3 in 1 hr"));

  sleepTimers.push(
    setTimeout(async () => {
      await ctx.channel.send("🛑 Sleep mode complete.\nBot shutting down...");
      setTimeout(() => {
        console.log("Bot shut down after sleep sequence.");
        ctx.channel.client.destroy();
        process.exit(0);
      }, 1000);
    }, 1.5 * 60 * 60 * 1000)
  );
}

async function runSingleAction(ctx, actionKey, member, timeArg) {
  if (!member) return ctx.reply("Select a user.");
  if (!member.voice.channel) return ctx.reply("That user is not in VC.");

  const cmd = ACTIONS[actionKey];
  return scheduleSingleAction(ctx, {
    member,
    delayMs: parseTime(timeArg),
    title: cmd.title,
    verb: cmd.verb,
    emoji: cmd.emoji,
    action: cmd.action,
    cancelId: `cancel_${actionKey}`,
    completedText: cmd.singleDone,
  });
}

async function runMassAction(ctx, actionKey, timeArg) {
  const vc = ctx.member?.voice?.channel;
  if (!vc) return ctx.reply("Join a voice channel first.");

  const members = [...vc.members.values()].filter((m) => !m.user.bot);
  if (!members.length) return ctx.reply("No members found.");

  const cmd = ACTIONS[actionKey];
  return scheduleMassAction(ctx, {
    members,
    delayMs: parseTime(timeArg),
    title: cmd.title,
    verb: cmd.verb,
    emoji: cmd.emoji,
    completeText: cmd.massDone,
    action: cmd.action,
    cancelId: `cancel_${actionKey}_all`,
  });
}

async function handleSleepCancel(ctx) {
  for (const timer of sleepTimers) clearTimeout(timer);
  sleepTimers.length = 0;

  for (const msg of sleepMessages) {
    try {
      await msg.delete();
    } catch {}
  }
  sleepMessages.length = 0;

  return ctx.channel.send("🌙 Nevermind I guess.");
}

async function handleAfk(ctx, mode) {
  if (mode === "leave") {
    const connection = getVoiceConnection(ctx.guild.id);
    if (!connection) return ctx.reply("❌ I'm not in a VC.");
    connection.destroy();
    return ctx.reply("🔇 Keepalive disabled. Left the VC.");
  }

  const vc = ctx.member?.voice?.channel;
  if (!vc) return ctx.reply("🎧 Join a voice channel first.");

  joinVoiceChannel({
    channelId: vc.id,
    guildId: vc.guild.id,
    adapterCreator: vc.guild.voiceAdapterCreator,
    selfDeaf: true,
  });

  return ctx.reply(`🔊 Keepalive enabled. Staying in **${vc.name}**.`);
}

const actionChoices = [
  { name: "Disconnect", value: "disconnect" },
  { name: "Deafen", value: "deafen" },
  { name: "Undeafen", value: "undeafen" },
  { name: "Mute", value: "mute" },
  { name: "Unmute", value: "unmute" },
];

const data = new SlashCommandBuilder()
  .setName("vc")
  .setDescription("Voice channel moderation & utility commands")
  .addSubcommand((sc) =>
    sc
      .setName("user")
      .setDescription("Affect one user")
      .addStringOption((o) =>
        o.setName("action").setDescription("What to do").setRequired(true).addChoices(...actionChoices)
      )
      .addUserOption((o) => o.setName("target").setDescription("Target user").setRequired(true))
      .addStringOption((o) => o.setName("time").setDescription("Delay, e.g. 30s, 2m, 1m30s (default 10s)").setRequired(false))
  )
  .addSubcommand((sc) =>
    sc
      .setName("all")
      .setDescription("Affect everyone in your current VC")
      .addStringOption((o) =>
        o.setName("action").setDescription("What to do").setRequired(true).addChoices(...actionChoices)
      )
      .addStringOption((o) => o.setName("time").setDescription("Delay, e.g. 30s, 2m, 1m30s (default 10s)").setRequired(false))
  )
  .addSubcommand((sc) =>
    sc
      .setName("afk")
      .setDescription("Keepalive controls")
      .addStringOption((o) =>
        o
          .setName("mode")
          .setDescription("Join or leave voice")
          .setRequired(true)
          .addChoices({ name: "On", value: "join" }, { name: "Off", value: "leave" })
      )
  )
  .addSubcommand((sc) => sc.setName("sleepcancel").setDescription("Cancel a pending sleep sequence"));

const vcCommand = {
  name: "vc",
  aliases: [
    "yeet",
    "deafen",
    "undeafen",
    "mute",
    "unmute",
    "yeetall",
    "deafenall",
    "undeafenall",
    "muteall",
    "unmuteall",
    "sleepcancel",
    "stayvc",
    "afkvc",
    "keepvcalive",
    "stopvcalive",
    "leavevc",
    "thxforkeepingthevcalive",
    "leave",
  ],
  data,

  async execute(message, args = [], client, invokedName) {
    const ctx = contextFrom(message);
    const name = (invokedName || "").toLowerCase();

    if (["stayvc", "afkvc", "keepvcalive"].includes(name)) return handleAfk(ctx, "join");
    if (["stopvcalive", "leavevc", "thxforkeepingthevcalive", "leave"].includes(name)) return handleAfk(ctx, "leave");
    if (name === "sleepcancel") return handleSleepCancel(ctx);

    const singleMap = {
      yeet: "disconnect",
      deafen: "deafen",
      undeafen: "undeafen",
      mute: "mute",
      unmute: "unmute",
    };

    const massMap = {
      yeetall: "disconnect",
      deafenall: "deafen",
      undeafenall: "undeafen",
      muteall: "mute",
      unmuteall: "unmute",
    };

    if (singleMap[name]) {
      const member = message.mentions.members.first();
      const timeArg = args.find((a) => !a.startsWith("<@"));
      return runSingleAction(ctx, singleMap[name], member, timeArg);
    }

    if (massMap[name]) {
      const timeArg = args[0];
      return runMassAction(ctx, massMap[name], timeArg);
    }

    return message.reply("Use `/vc user`, `/vc all`, `/vc afk`, or `/vc sleepcancel`.");
  },

  async executeInteraction(interaction) {
    const sub = interaction.options.getSubcommand();
    const ctx = contextFrom(interaction);

    await interaction.reply({ content: "⏳ On it...", ephemeral: true });

    if (sub === "sleepcancel") return handleSleepCancel(ctx);
    if (sub === "afk") return handleAfk(ctx, interaction.options.getString("mode", true));

    if (sub === "user") {
      const action = interaction.options.getString("action", true);
      const user = interaction.options.getUser("target", true);
      const member = interaction.options.getMember("target") || (await interaction.guild.members.fetch(user.id).catch(() => null));
      return runSingleAction(ctx, action, member, interaction.options.getString("time"));
    }

    if (sub === "all") {
      return runMassAction(ctx, interaction.options.getString("action", true), interaction.options.getString("time"));
    }
  },
};

vcCommand.scheduleSleep = (source, vc) => scheduleSleep(contextFrom(source), vc);

module.exports = vcCommand;