const { EmbedBuilder } = require("discord.js");
const { animateEmbed } = require("../utils/animateEmbed");

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = {
    name: "sleep",

    async execute(message) {
        const mentioned = message.mentions.members.first();

        // ✅ RULE FIX:
        // mention → target = mentioned
        // no mention → target = executor
        const target = mentioned || message.member;

        const isMentioned = !!mentioned;

        // 🌙 outcome system
        const roll = Math.random();

        let outcomeType;
        if (roll < 0.05) outcomeType = "allnighter";
        else if (roll < 0.55) outcomeType = "sleep";
        else if (roll < 0.85) outcomeType = "inbetween";
        else outcomeType = "awake";

        // ✅ CLEAN ADVISORY TEXT (NO DRAMA)
        const sleepAdvice = [
            "should sleep.",
            "for you sleep is recommended.",
            ", rest would be beneficial.",
            "You are due for sleep.",
            "Go sleep RIGHT NOW!!",
        ];

        const awakeAdvice = [
            "should stay awake and continue normally.",
            "is in a good state to remain active.",
            "does not need sleep right now.",
            "is best kept awake for now.",
            "should avoid sleeping at the moment.",
            "has sufficient energy to stay awake.",
            "is recommended to stay active.",
            "sleep is unnecessary right now.",
        ];

        const inbetweenAdvice = [
            "Stay awake for a few minutes, then reconsider.",
            "Hold off sleep for a short while (2–5 minutes).",
            "You’re in a transition phase — wait a bit before sleeping.",
            "Not ready for sleep yet — try again in a few minutes.",
            "Delay sleep decision by a few minutes.",
        ];

        const allNighterAdvice = [
            "Sleep is not happening tonight.",
            "You are in all-nighter mode.",
            "No sleep recommended at all.",
            "You will remain awake.",
        ];

        const build = (title, desc, color) =>
            new EmbedBuilder()
                .setColor(color)
                .setTitle(title)
                .setDescription(desc);

        const stages = [
            build(
                "💭 Evaluating sleep recommendation...",
                isMentioned
                    ? `Checking recommendation for ${target.toString()}`
                    : `Checking recommendation for YOU`,
                "Blue"
            ),

            build(
                "⚖️ Processing sleep factors...",
                "Analyzing rest vs activity balance...",
                "Blurple"
            ),

            build(
                "📊 Computing result...",
                "Final recommendation incoming...",
                "DarkBlue"
            ),

            build(
                "🌙 Sleep Recommendation",
                getOutcomeText(),
                getOutcomeColor()
            ),
        ];

        function getOutcomeText() {
            if (outcomeType === "allnighter") {
                return `${target.toString()} ${pick(allNighterAdvice)}`;
            }

            if (outcomeType === "sleep") {
                return `${target.toString()} ${pick(sleepAdvice)}`;
            }

            if (outcomeType === "inbetween") {
                return `${target.toString()} ${pick(inbetweenAdvice)}`;
            }

            return `${target.toString()} ${pick(awakeAdvice)}`;
        }

        function getOutcomeColor() {
            if (outcomeType === "allnighter") return "Purple";
            if (outcomeType === "sleep") return "Green";
            if (outcomeType === "inbetween") return "Yellow";
            return "Orange";
        }

        await animateEmbed({
            message,
            stages,
            interval: 1200,
        });
    },
};
