require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const { REST, Routes } = require("discord.js");

const REGISTER_GLOBALLY = false; // true = global, false = guild

const COMMANDS_DIR = path.join(__dirname, "commands");

function collectSlashCommandData(dir) {
  const collected = [];
  const seen = new Map();
  const files = fs.readdirSync(dir).filter((file) => file.endsWith(".js"));

  for (const file of files) {
    const command = require(path.join(dir, file));
    if (!command.data) continue;

    const builders = Array.isArray(command.data) ? command.data : [command.data];
    for (const builder of builders) {
      const json = builder.toJSON();

      if (seen.has(json.name)) {
        throw new Error(
          `Duplicate slash command name "${json.name}" found in "${file}" — it was already registered by "${seen.get(json.name)}".`
        );
      }

      seen.set(json.name, file);
      collected.push(json);
    }
  }

  return collected;
}

const commands = collectSlashCommandData(COMMANDS_DIR);
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Registering ${commands.length} slash command(s)...`);
    console.log(commands.map((c) => c.name).join(", "));

    const route = REGISTER_GLOBALLY
      ? Routes.applicationCommands(process.env.CLIENT_ID)
      : Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID);

    const result = await rest.put(route, { body: commands });

    console.log(`Successfully registered ${result.length} command(s).`);
  } catch (error) {
    console.error("Failed to register slash commands:", error);
  }
})();