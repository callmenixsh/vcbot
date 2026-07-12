require("dotenv").config();
const { REST, Routes } = require("discord.js");

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: [] }
    );

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: [] }
    );

    console.log("Cleared global and guild slash commands.");
  } catch (error) {
    console.error(error);
  }
})();