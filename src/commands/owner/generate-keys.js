const { ApplicationCommandType, AttachmentBuilder } = require("discord.js");
const { owner, us, ks } = require("../../databases/index");

module.exports = {
    name: "gerarkey",
    description: "gerar key diário,semanal ou mensal",
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: "formato",
            description: "Formato da fila",
            type: 3,
            required: true,
            choices: [
                { name: "1V1", value: "1v1" },
                { name: "2V2", value: "2v2" },
                { name: "3V3", value: "3v3" },
                { name: "4V4", value: "4v4" }
            ]
        },
        {
            name: "tipo",
            description: "Tipo da key",
            type: 3,
            required: true,
            choices: [
                { name: "Diária", value: "diario" },
                { name: "Semanal", value: "semanal" },
                { name: "Mensal", value: "mensal" }
            ]
        },
        {
            name: "quantidade",
            description: "Quantidade de dias/semanas/meses",
            type: 4,
            required: false
        },
        {
            name: "quantidade_keys",
            description: "Quantidade de chaves a gerar",
            type: 4,
            required: false
        }
    ],
    run: async (client, interaction) => {
        if (!owner.includes(interaction.user.id)) return interaction.reply({
            content: "Você não tem permissão para usar este comando.",
            flags: [64]
        });
        const formato = interaction.options.getString("formato");
        const tipo = interaction.options.getString("tipo");
        const quantidade = interaction.options.getInteger("quantidade") || 1;
        const quantidade_keys = interaction.options.getInteger("quantidade_keys") || 1;

        let dias = 1;
        if (tipo === "diario") dias = 1 * quantidade;
        if (tipo === "semanal") dias = 7 * quantidade;
        if (tipo === "mensal") dias = 30 * quantidade;

        const generated = [];
        for (let i = 0; i < quantidade_keys; i++) {
            const code = Math.random().toString(36).substring(2, 17).toUpperCase();

            await ks.set(`key_${code}`, { formato, tipo, dias });
            generated.push({ code, formato, tipo, dias });
        }

        const lines = generated.map(k => `${k.code} | formato: ${k.formato} | tipo: ${k.tipo} | dias: ${k.dias}`);
        const content = `Keys geradas: ${generated.length}\n\n` + lines.join("\n");

        const attachment = new AttachmentBuilder(Buffer.from(content, "utf8"), { name: `keys_${formato}_${tipo}_${Date.now()}.txt` });

        return interaction.reply({
            content: `\`✅\` ${generated.length} key(s) gerada(s) para o formato \`${formato}\`. Arquivo anexo com a lista.`,
            files: [attachment],
            flags: [64]
        });
    }
};
