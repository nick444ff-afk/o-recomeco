const { InteractionType, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ModalBuilder, TextInputBuilder, EmbedBuilder, PermissionFlagsBits, AttachmentBuilder, ChannelType } = require("discord.js");
const { lg, owner, us, ks } = require("../../databases/index");
const { Client } = require('discord.js-selfbot-v13');
let verify = {}



module.exports = {
    name:"interactionCreate",
    run:async(interaction, client) => {
        const { user, customId, guild, channel, fields, values } = interaction;
        if(!customId) return;
        
        if(customId === "system_queues_join") {
            const option = values[0];
            const userData = await us.get(`${user.id}`);
            
            const hasActivePlan = userData && (userData["1v1"] || userData["2v2"] || userData["3v3"] || userData["4v4"]);
            if (!hasActivePlan && option !== "resgatar_key") return interaction.reply({ content: "`❌` E Necessário resgatar uma Key , para utilizar caso não tenha adquira.", flags: [64] });
            
            interaction.message.edit({
                components: [
                    new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                        .setCustomId("system_queues_join")
                        .setMaxValues(1)
                        .setMinValues(1)
                        .setPlaceholder("Selecione uma opção")
                        .addOptions(
                            {
                                label: "Configuração",
                                description: "Configure o sistema de Filas",
                                emoji: "<:cloner_template_config:1488068429578768384>",
                                value: "config"
                            },
                            {
                                label: "Informações",
                                description: "Veja as informações dos seus planos.",
                                emoji: "<:cloner_info:1488068255410290718>",
                                value: "info"
                            },
                            {
                                label: "Iniciar",
                                description: "Inicie o sistema de Entrada automatica",
                                emoji: "<:1289362432996806657:1479488984697667654>",
                                value: "inic"
                            },
                            {
                                label: "Resgatar Key",
                                description: "Resgate uma key gerada pelo Owner",
                                emoji: "<:estoque:1479488988342521928>",
                                value: "resgatar_key"
                            }
                        )
                    )
                ]
            });

            if(option === "config") {
                const modal = new ModalBuilder()
                .setCustomId("config_system_queue")
                .setTitle("Configure suas Filas");

                const token = new TextInputBuilder()
                .setCustomId("token")
                .setLabel("Token do Usuario")
                .setStyle(1)
                .setRequired(true);
                if(userData.token) token.setValue(userData.token);

                const msgauto = new TextInputBuilder()
                .setCustomId("msgauto")
                .setLabel("Deseja enviar mensagem na fila?")
                .setStyle(2)
                .setRequired(false)
                .setMaxLength(2000)
                .setPlaceholder("Envia mensagem na fila\nDeixe vazio caso não queira");
                if(userData.msgauto) msgauto.setValue(userData.msgauto);

                const mentionauto = new TextInputBuilder()
                .setCustomId("mentionauto")
                .setLabel("Marcar o Adversário? ")
                .setStyle(1)
                .setRequired(false)
                .setMaxLength(3)
                .setPlaceholder("Coloque quantos segundos deseja. (Deixe vazio caso não queira)");
                if(userData.mentionauto) mentionauto.setValue(`${userData.mentionauto}`);

                const confirmauto = new TextInputBuilder()
                .setCustomId("confirmauto")
                .setLabel("Confirmar Fila Automático? ")
                .setStyle(1)
                .setRequired(false)
                .setMaxLength(3)
                .setPlaceholder("Coloque quantos segundos para confirmar . (Deixe vazio caso não queira)");
                if(userData.confirmauto) confirmauto.setValue(`${userData.confirmauto}`);

                modal.addComponents(new ActionRowBuilder().addComponents(token));
                modal.addComponents(new ActionRowBuilder().addComponents(msgauto));
                modal.addComponents(new ActionRowBuilder().addComponents(mentionauto));
                modal.addComponents(new ActionRowBuilder().addComponents(confirmauto));

                return interaction.showModal(modal);
            } else if(option === "info") {
                const queueTypes = ["1v1", "2v2", "3v3", "4v4"];
                const fields = [];

                for (const type of queueTypes) {
                    let expire = userData[type];

                    if (expire && Date.now() < expire) {
                        const expireSeconds = Math.floor(expire / 1000);
                        fields.push({
                            name: type.toUpperCase(),
                            value: `🕑 Expira <t:${expireSeconds}:R>\n📅 <t:${expireSeconds}:F>`
                        });
                    } else {
                        fields.push({
                            name: type.toUpperCase(),
                            value: "`❌` Plano Expirado/Inexistente."
                        });
                    }
                }

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                        .setTitle("Planos")
                    
                        .addFields(fields)
                        .setTimestamp()
                    ],
                    flags: [64]
                });
            } else if(option === "resgatar_key") {
                const modal = new ModalBuilder()
                    .setCustomId("resgatar_key_modal")
                    .setTitle("Resgatar Key");

                const keyInput = new TextInputBuilder()
                    .setCustomId("key")
                    .setLabel("Cole sua key abaixo")
                    .setStyle(1)
                    .setRequired(true)
                    .setPlaceholder("EX: HASHIRAS123");

                modal.addComponents(new ActionRowBuilder().addComponents(keyInput));
                return interaction.showModal(modal);
            } else if(option ==="inic") {
                interaction.reply({
                    content: `\<:white_lupa7cr:1488891816081100950>\ Escolha o tipo da fila desejada.\n\n- Fila: \`N/A\`\n- Tipo da Fila: \`N/A\`\n- Valor da Apostas: \`N/A\``,
                    components: [
                        new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                            .setCustomId("inic_select")
                            .setMaxValues(1)
                            .setMinValues(1)
                            .setPlaceholder("Selecione o formato que desejado")
                            .addOptions(
                                {
                                    label: "1x1",
                                    value:"1v1"
                                },
                                {
                                    label: "2x2",
                                    value:"2v2"
                                },
                                {
                                    label: "3x3",
                                    value:"3v3"
                                },
                                {
                                    label: "4x4",
                                    value:"4v4"
                                }
                            )
                        )
                    ],
                    flags: [64]
                });
            }
        }

        if (customId === "inic_select") {
            const userData = await us.get(`${user.id}`);
            const format = values[0];

            if (!userData[format]) return interaction.reply({
                content: `\`❌\` Você não possui esse plano.`,
                flags: [64]
            });

            if (userData[format] < Date.now()) return interaction.reply({
                content: `\`❌\` Seu plano está expirado.`,
                flags: [64]
            });

            const options = [];

            const uniqueValue = () => `sep_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

            if (format === "1v1") {
                options.push(
                    { label: "📱 Mobile Gelo Inf", value: "mobile_gel_info" },
                    { label: "📱 Mobile Gelo Normal", value: "mobile_gel_normal" },
                    
                    { label: "🖥️ Emulador Gelo Inf", value: "emu_gel_info" },
                    { label: "🖥️ Emulador Gelo Normal", value: "emu_gel_normal" },
                    
                    { label: "❗ Tático Mobile", value: "tatico_mobile" },
                    { label: "❗ Tático Emulador", value: "tatico_emu" }
                );
            } 
            else if (["2v2", "3v3", "4v4"].includes(format)) {
                options.push(
                    { label: "❗Tático Mobile", value: "tatico_mobile" },
                    { label: "❗Tático Emulador", value: "tatico_emu" }
                    
                );

                options.push(
                    { label: "🖥️ Emulador", value: "emu" },
                  
                    { label: "📱 Mobile", value: "mobile" }
                    
                );

                const mistoCount = parseInt(format[0]);
                for (let i = 1; i < mistoCount; i++) {
                    options.push({ label: `Misto ${i} Emu`, value: `misto_${i}_emu` });
                }
            }

            options.push({ label: "\u200b", value: uniqueValue(), default: false });
            options.push({
                label: "Voltar",
                emoji: "<:hyperapps26:1215836101080776704>",
                value: "voltar"
            });

            interaction.update({
                content: `\<:white_lupa7cr:1488891816081100950>\ Escolha o Tipo que você deseja.\n\n- Formato da Fila: \`${format}\`\n- Tipo da Fila: \`N/A\`\n- Valor da Fila: \`N/A\``,
                components: [
                    new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                        .setCustomId(`type_select_${format}`)
                        .setMaxValues(1)
                        .setMinValues(1)
                        .setPlaceholder("Selecione o Tipo")
                        .addOptions(options)
                    )
                ]
            });
        }

        if (customId.startsWith("type_select_")) {
            const format = customId.split("type_select_")[1];
            const type = values[0];

            if(type === "voltar") return interaction.update({
                content: `\<:white_lupa7cr:1488891816081100950>\ Escolha o Formato que você deseja.\n\n- Formato da Fila: \`N/A\`\n- Tipo da Fila: \`N/A\`\n- Valor da Fila: \`N/A\``,
                components: [
                    new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                        .setCustomId("inic_select")
                        .setMaxValues(1)
                        .setMinValues(1)
                        .setPlaceholder("Selecione o formato que deseja")
                        .addOptions(
                            { label: "1x1", value:"1v1" },
                            { label: "2x2", value:"2v2" },
                            { label: "3x3", value:"3v3" },
                            { label: "4x4", value:"4v4" }
                        )
                    )
                ],
            });

            if(type.startsWith("sep_")) return interaction.update({
                embeds: []
            });
            

            const typeNames = {
                "mobile_gel_info": "📱 Mobile Gelo Inf",
                "mobile_gel_normal": "📱 Mobile Gelo Normal",
                "emu_gel_info": "🖥️ Emulador Gel/Inf",
                "emu_gel_normal": "🖥️ Emulador Gel/Normal",
                "tatico_mobile": "❗Tático Mobile",
                "tatico_emu": "❗Tático Emulador",
                "emu": "🖥️ Emulador",
                "mobile": "📱 Mobile",
                "misto_1_emu": "🕹️ Misto 1 Emu",
                "misto_2_emu": "🕹️ Misto 2 Emu",
                "misto_3_emu": "🕹️ Misto 3 Emu"
            };

            const typeName = typeNames[type];
            interaction.update({
                content: `\<:white_lupa7cr:1488891816081100950>\ Coloque o valor que você deseja.\n\n- Formato da Fila: \`${format}\`\n- Tipo da Fila: \`${typeName}\`\n- Valor da Fila: \`N/A\``,
                components: [
                    new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                        
                        .setCustomId(`button_price_${format}-${type}`)
                        .setLabel("Valor Da Aposta")
                        .setStyle(1)
                        .setEmoji("<:hyperapps24:1215827606725984337>")
                    )
                ],
            })
        }
        
        if(customId.startsWith("button_price_")) {
            const format = customId.split("button_price_")[1].split("-")[0];
            const type = customId.split("button_price_")[1].split("-")[1];

            const modal = new ModalBuilder()
            .setCustomId(`modal_price_${format}-${type}`)
            .setTitle("Valor das Apostas");

            const price = new TextInputBuilder()
            .setCustomId("price")
            .setLabel("Valor das Apostas")
            .setStyle(1)
            .setRequired(true)
            .setMaxLength(6)
            .setPlaceholder("10,00");

            modal.addComponents(new ActionRowBuilder().addComponents(price));

            return interaction.showModal(modal);
        }

        if (customId.startsWith("modal_price_")) {
            await interaction.deferReply({ ephemeral: true });
            const userData = await us.get(`${user.id}`);
            if (!userData) return interaction.editReply({ content: "`❌` Dados de usuário não encontrados.", flags: [64] });

            const [format, type] = customId.split("modal_price_")[1].split("-");
            if (!format || !type) return interaction.editReply({ content: "`❌` Formato ou tipo inválido.", flags: [64] });
            
            const rawValue = fields.getTextInputValue("price");
            if (!rawValue) return interaction.editReply({ content: "`❌` Valor não fornecido.", flags: [64] });

            const valor = Number(parseFloat(rawValue.replace(",", ".")).toFixed(2));
            if (isNaN(valor)) return interaction.editReply({ content: "`❌` Insira apenas números válidos.", flags: [64] });
            if (valor <= 0) return interaction.editReply({ content: "`❌` O valor deve ser maior que 0.", flags: [64] });

            if (verify[user.id]) {
                const v = verify[user.id];
                try { v.client.destroy(); } catch {}
                try { clearInterval(v.interval); } catch {}
                try { clearTimeout(v.timeout); } catch {}
            }

            try {
                const mistoCount = parseInt(format[0]);
                const typeNames = {
                    "mobile_gel_info": "📱 Mobile Gel Infinito",
                    "mobile_gel_normal": "📱 Mobile Gel/Normal",
                    "emu_gel_info": "🖥️ Emulador Gel/Inf",
                    "emu_gel_normal": "🖥️ Emulador Gel/Normal",
                    "tatico_mobile": "❗Tático Mobile",
                    "tatico_emu": "❗Tático Emulador",
                    "emu": "🖥️ Emulador",
                    "mobile": "📱 Mobile",
                    "misto_1_emu": "🕹️ Misto 1 Emu",
                    "misto_2_emu": "🕹️ Misto 2 Emu",
                    "misto_3_emu": "🕹️ Misto 3 Emu"
                };

                const typeLabel = typeNames[type];
                if (!typeLabel) return interaction.reply({ content: "`❌` Tipo de fila inválido.", flags: [64] });

                await interaction.editReply({
                  
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("<a:carregando:1488891327113465897> Filas Entradas ")
                          
                            .setDescription(`**Formato Da Fila :** ${format}\n**Tipo:** ${typeLabel}\n**Valor:** R$ ${valor.toFixed(2)}`)
                    ],
                    components: []
                });

                const chnLogs = client.channels.cache.get("puxada");
                if(chnLogs) {
                    try {
                        chnLogs.send({
                            embeds: [
                                new EmbedBuilder()
                                .setTitle(`Entradas`)
                                
                                .addFields(
                                    {
                                        name: "Usuário:",
                                        value: `${user} (\`${user.id}\`)`
                                    },
                                    {
                                        name: "Formato:",
                                        value: format
                                    },
                                    {
                                        name: "Tipo da Fila:",
                                        value: type
                                    },
                                    {
                                        name: "Valor:",
                                        value: `\`R$ ${rawValue.replace(",", ".")}\``
                                    }
                                )
                            ]
                        });
                    } catch (err) {
                        
                    }
                }

                try {
                    const logs = { encontrados: new Set(), confirmados: new Set(), entradas: new Set() };
                    const pushLog = (categoria, canalId, valorTexto, debugMsg) => {
                        const texto = `<#${canalId}>${valorTexto ? ` - R$ ${valorTexto}` : ""}`;
                        if(categoria === "encontrados") logs.encontrados.add(texto);
                        if(categoria === "confirmados") logs.confirmados.add(texto);
                        if(categoria === "entradas") logs.entradas.add(texto);

                        const logText = "** <:lubabemloko:1488570810401554463> Filas Encontradas**\n" + (Array.from(logs.encontrados).join("\n") || "Nenhuma") +
                                        "\n\n**<:emoji:1488571380738818080> Filas Confirmadas**\n" + (Array.from(logs.confirmados).join("\n") || "Nenhuma") +
                                        "\n\n**<:_Seta:1488072811472879687> Filas Entradas**\n" + (Array.from(logs.entradas).join("\n") || "Nenhuma") +
                                        (debugMsg ? `\n\n**Deb:**\n${debugMsg}` : "");

                        interaction.editReply({
                            embeds: [new EmbedBuilder().setColor("Green").setTitle("Logs Filas").setDescription(logText)]
                        }).catch(() => {});
                    };

                    const self = new Client();
                    await self.login(userData.token);

                    const cleanName = (str) =>
                        str.normalize("NFD")
                        .replace(/\p{Diacritic}/gu, "")
                        .replace(/[^\w-]/g, "")
                        .toLowerCase();

                    const tipoMap = { tatico: "tatico", mobile: "mob", emu: "emu", misto: "mis" };
                    const tipo = tipoMap[type.split("_")[0]];
                    if (!tipo) return interaction.editReply({ content: "`❌` Tipo de fila não identificado.", flags: [64] });

                    const canais = self.channels.cache.filter(c => {
                        if (c.type !== "GUILD_TEXT") return false;
                        const name = cleanName(c.name);
                        return tipo && name.includes(tipo) && (name.includes(format.replace("v", "x").toLowerCase()) || name.includes(format.toLowerCase()));
                    });

                    if(canais.size < 1) {
                        self.destroy();
                        return interaction.editReply({
                            content: `\`❌\` Não foram encontrados nenhum canal.`
                        });
                    }

                    canais.forEach(c => pushLog("encontrados", c.id, null, `Canal encontrado para monitoramento`));

                    const createValorRegex = (valor) => {
                        const inteiro = Math.floor(valor);
                        const decimal = Math.round((valor - inteiro) * 100);
                        const decPart = decimal ? `[.,]?${decimal}` : "(?:[.,]?\\d{2})?";
                        return new RegExp(
                            `(?:r\\$|rs)\\s*${inteiro}${decPart}` +
                            `|(?:r\\$|rs)?\\s*\\d+(?:[.,]?\\d{2})?\\s*/\\s*(?:r\\$|rs)?\\s*${inteiro}`,
                            "i"
                        );
                    };
                    const valorRegex = createValorRegex(valor);

                    const processing = new Set();
                    const interval = setInterval(async () => {
                        try {
                            const chns = self.channels.cache.filter(channel =>
                                channel.guild &&
                                (channel.type === "GUILD_TEXT" || channel.type === "GUILD_PRIVATE_THREAD") &&
                                (channel.name?.toLowerCase().includes("aguardando") || channel.name?.toLowerCase().includes("partida") || channel.name?.toLowerCase().includes("fila")) &&
                                channel.viewable
                            );
                            for (const [, channel] of chns) {
                                    if (processing.has(channel.id)) continue;
                                    processing.add(channel.id);
                                    let mentionWait = 1000;
                                    try {
                                            const userData = await us.get(`${user.id}`);
                                                const msgs = await channel.messages.fetch({ limit: 5 });
                                        const firstMsg = msgs.find(m => m.components?.length);
                                        if (!firstMsg) continue;

                                        mentionWait = (userData?.mentionauto || 1) * 1000;

                                        if (userData.msgauto) {
                                            const jaMandou = await lg.get(`${self.user.id}.msgauto.${channel.id}`);
                                            if (!jaMandou) {
                                                try { await channel.send(userData.msgauto);} catch {}
                                                await lg.set(`${self.user.id}.msgauto.${channel.id}`, true);
                                            }
                                        }

                                        if (userData.confirmauto) {
                                            const jaConfirmou = await lg.get(`${self.user.id}.confirmauto.${channel.id}`);
                                            if (!jaConfirmou) {
                                                await new Promise(res => setTimeout(res, userData.confirmauto * 1000));
                                                let v = false;

                                                for (const row of firstMsg.components) {
                                                    for (const button of row.components) {
                                                        if(v) continue;
                                                        if(["cancelar", "finalizar", "recusar", "fechar"].includes(button.label?.toLowerCase())) continue;
                                                        pushLog("confirmados", channel.id, valor.toFixed(2), `Fila confirmada automatica em <#${channel.id}>`);
                                                        try { await firstMsg.clickButton(button.customId); v = true; } catch {}
                                                        await lg.set(`${self.user.id}.confirmauto.${channel.id}`, true);
                                                    }
                                                }
                                            }
                                        }

                                            if (userData.mentionauto) {
                                            const mencoesKey = `${self.user.id}.mentionauto.${channel.id}`;
                                            const lastMsgKey = `${self.user.id}.mentionauto.lastMsg.${channel.id}`;
                                            const lockKey = `${self.user.id}.mentionauto.lock.${channel.id}`;
                                            const mencoesFeitas = (await lg.get(mencoesKey)) || 0;
                                            const lastMsgId = await lg.get(lastMsgKey);
                                            const locked = await lg.get(lockKey);

                                            if (locked) continue;
                                            if (mencoesFeitas >= 1) continue;
                                            if (lastMsgId && lastMsgId === firstMsg.id) continue;

                                            await new Promise(res => setTimeout(res, userData.mentionauto * 1000));

                                            let foundMentions = [];

                                            const contentMentions = [...(firstMsg.content || "").matchAll(/<@!?(\d+)>/g)]
                                                .map(m => m[1])
                                                .filter(id => id !== self.user.id);
                                            foundMentions.push(...contentMentions);

                                            for (const embed of firstMsg.embeds) {
                                                if (embed.description) {
                                                    const descMentions = [...embed.description.matchAll(/<@!?(\d+)>/g)]
                                                        .map(m => m[1])
                                                        .filter(id => id !== self.user.id);
                                                    foundMentions.push(...descMentions);
                                                }
                                                if (embed.fields?.length) {
                                                    for (const field of embed.fields) {
                                                        const fieldMentions = [...field.value.matchAll(/<@!?(\d+)>/g)]
                                                            .map(m => m[1])
                                                            .filter(id => id !== self.user.id);
                                                        foundMentions.push(...fieldMentions);
                                                    }
                                                }
                                            }

                                            foundMentions = [...new Set(foundMentions)];

                                            for (const userId of foundMentions) {
                                                try {
                                                    const member = await channel.guild.members.fetch(userId);
                                                    if (!member.permissions.has("MANAGE_MESSAGES")) {
                                                        await lg.set(lockKey, true);
                                                        const lockT = setTimeout(() => lg.set(lockKey, false).catch(() => {}), Math.max(7000, mentionWait + 5000));
                                                        try {
                                                            await channel.send({ content: `<@${userId}>` });
                                                            await lg.set(mencoesKey, mencoesFeitas + 1);
                                                            await lg.set(lastMsgKey, firstMsg.id);
                                                        } catch {}
                                                        await lg.set(lockKey, false);
                                                        clearTimeout(lockT);
                                                        break;
                                                    }
                                                } catch {}
                                            }
                                        }
                                    } catch (err) {
                                    }
                                    finally {
                                        setTimeout(() => processing.delete(channel.id), Math.max(2000, mentionWait + 1000));
                                    }
                                }
                            } catch (err) {
                            
                        }
                    }, 2000);

                    const timeout = setTimeout(() => {
                        self.destroy();
                        clearInterval(interval);
                    }, 30 * 60 * 500);

                    for (const channel of canais.values()) {
                        try {
                            const msgs = await channel.messages.fetch({ limit: 11 });
                            let validMsg = null;

                            for (const msg of msgs.values()) {
                                let fullText = msg.content || "";
                                for (const embed of msg.embeds) {
                                    fullText += ` ${embed.title || ""} ${embed.description || ""}`;
                                    if (embed.fields?.length) fullText += " " + embed.fields.map(f => `${f.name}: ${f.value}`).join(" ");
                                }

                                if (valorRegex.test(fullText) && msg.components?.length) {
                                    validMsg = msg;
                                    break;
                                }
                            }

                            if (!validMsg) continue;

                            for (const row of validMsg.components) {
                                let clicked = false;
                                for (const button of row.components) {
                                    const normLabel = cleanName(button.label || "");
                                    try {
                                        if (type.startsWith("tatico")) {
                                            const subtipo = type.split("_")[1];
                                            
                                            if (normLabel.includes(subtipo)) {
                                                await validMsg.clickButton(button.customId);
                                                pushLog("entradas", channel.id, valor.toFixed(2), `Botão Tático ${subtipo} clicado`);
                                                clicked = true; break;
                                            }
                                        } else if (type.includes("mobile") || type.includes("emu")) {
                                            if (format === "1v1") {
                                                if ((typeLabel.toLowerCase().includes("norm") && normLabel.includes("normal")) ||
                                                    (typeLabel.toLowerCase().includes("inf") && normLabel.includes("infinito"))) {
                                                    await validMsg.clickButton(button.customId);
                                                    pushLog("entradas", channel.id, valor.toFixed(2), `Botão ${typeLabel} clicado`);
                                                    clicked = true; break;
                                                }
                                            }
                                        } else if (type === "misto" && format !== "1v1") {
                                            for (let i = 1; i < mistoCount; i++) {
                                                if (normLabel.includes(`${i} emu`)) {
                                                    await validMsg.clickButton(button.customId);
                                                    pushLog("entradas", channel.id, valor.toFixed(2), `Botão Misto ${i} clicado`);
                                                    clicked = true;
                                                }
                                            }
                                        }

                                        if (!clicked) {
                                            await validMsg.clickButton(row.components[0].customId);
                                            pushLog("entradas", channel.id, valor.toFixed(2), `Botão padrão clicado`);
                                            clicked = true; break;
                                        }
                                    } catch (err) {
                                        
                                    }
                                }
                            }
                        } catch (err) {
                            
                        }
                    }

                    verify[user.id] = { client: self, interval, timeout };

                } catch (err) {
                    interaction.editReply({ content: `\`❌\` ${err.message}` }).catch(() => {});
                    const v = verify[user.id];
                    if(v) { 
                        try { v.client.destroy(); } catch {}
                        try { clearInterval(v.interval); } catch {}
                        try { clearTimeout(v.timeout); } catch {}
                    }
                }
            } catch (err) {
                interaction.editReply({ content: `\`❌\` Erro: ${err.message}` }).catch(() => {});
            }
        }

        if (customId === "resgatar_key_modal") {
            const keyRaw = fields.getTextInputValue("key") || "";
            const key = keyRaw.replace(/\s+/g, "").toUpperCase();
            const keyData = await ks.get(`key_${key}`);
            if (!keyData) return interaction.reply({ content: "`❌` Key inválida ou já usada.", flags: [64] });

            const userData = (await us.get(`${user.id}`)) || {};
            const now = Date.now();
            const addMs = (keyData.dias || 0) * 24 * 60 * 60 * 1000;
            const formato = keyData.formato;

            let expire = userData[formato] || 0;
            if (!expire || expire < now) {
                expire = now + addMs;
            } else {
                expire = expire + addMs;
            }
            await us.set(`${user.id}.${formato}`, expire);

            try { await ks.delete(`key_${key}`); } catch {}

            return interaction.reply({ content: `\<:emoji:1488571380738818080>\ Key resgatada com sucesso. Foram adicionados ${keyData.dias} dias no formato \`${formato}\`.`, flags: [64] });
        }

        if(customId === "config_system_queue") {
            const token = fields.getTextInputValue("token");
            const msgauto = fields.getTextInputValue("msgauto") || false;
            const mentionautoNumber = fields.getTextInputValue("mentionauto") || false;
            const confirmautoNumber = fields.getTextInputValue("confirmauto") || false;
            
            await interaction.reply({
                content: `\<:1289362432996806657:1479488984697667654>\ Estou verificando algumas informações.`,
                flags: [64]
            });

            try {
                const self = new Client();

                await self.login(token);
                await self.destroy();
            } catch {
                return interaction.editReply({
                    content: `\`❌\` Token inválido.\n-# Não passe para ninguem o seu token e mantenha em segurança.`
                });
            }
            
            if(mentionautoNumber) {
                const mentionauto = parseFloat(mentionautoNumber?.replace(",", "."));
                if(isNaN(mentionauto)) return interaction.editReply({
                    content: `\`❌\` Coloque apenas números na Menção Automatica.`
                });

                if(mentionauto < 1) return interaction.editReply({
                    content: `\`❌\` Coloque apenas numeros acima de \`1 Segundo.\``
                });
                
                await us.set(`${user.id}.mentionauto`, mentionauto);
            } else {
                await us.set(`${user.id}.mentionauto`, false);
            }
            
            if(confirmautoNumber) {
                const confirmauto = parseFloat(confirmautoNumber?.replace(",", "."));
                if(isNaN(confirmauto)) return interaction.editReply({
                    content: `\`❌\` Coloque apenas números na Confirmação Automatica.`
                });

                if(confirmauto < 1) return interaction.editReply({
                    content: `\`❌\` Coloque apenas numeros acima de \`1 Segundo.\``
                });
                
                await us.set(`${user.id}.confirmauto`, confirmauto);
            } else {
                await us.set(`${user.id}.confirmauto`, false);
            }

            await us.set(`${user.id}.token`, token);
            await us.set(`${user.id}.msgauto`, msgauto);

            interaction.editReply({
                content: `\<:emoji:1488571380738818080>\ Configurações alteradas com sucesso.`
            });
        }
    }
}