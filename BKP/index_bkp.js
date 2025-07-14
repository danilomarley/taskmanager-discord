const { data, saveData } = require('./database');
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
} = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const DATA_FILE = './atividades.json';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const commands = [
  new SlashCommandBuilder()
    .setName('atividade')
    .setDescription('Cria uma nova atividade com metas de forma visual'),
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('Registrando comandos...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('Comando /atividade registrado.');
  } catch (error) {
    console.error(error);
  }
})();

client.once('ready', () => {
  console.log(`Bot online como ${client.user.tag}`);
});

// Criação da embed
function createMetaEmbed(atividade, metaIndex) {
  const meta = atividade.metas[metaIndex];
  const concluido = meta.progresso >= meta.meta ? '✅ CONCLUÍDA' : '';
  const contribs = meta.contribuicoes || {};

  const usuariosFormatados = Object.entries(contribs)
    .map(([user, val]) => {
      const prog = val.progresso || 0;
      const ajuda = val.ajuda || 0;
      let partes = [];
      if (prog > 0) partes.push(`${prog}🔧`);
      if (ajuda > 0) partes.push(`${ajuda}👍`);
      return `_${user} (${partes.join(' + ')})_`;
    })
    .join(', ') || '_Ninguém ainda_';

  const valorCampo = `**${meta.progresso} / ${meta.meta}** ${concluido}\n\n` +
                     `*Contribuidores:* ${usuariosFormatados}`;

  return new EmbedBuilder()
    .setTitle(`🎯 Atividade: ${atividade.nome}`)
    .setDescription(`📝 ${atividade.descricao}`)
    .addFields({
      name: `**${metaIndex + 1}. ${meta.nome.toUpperCase()}**`,
      value: valorCampo,
    })
    .setColor('#5865F2')
    .setTimestamp();
}

function createMetaButtonRow(atividade, metaIndex) {
  const meta = atividade.metas[metaIndex];
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`meta_${atividade.nome}_${metaIndex}_up`)
      .setLabel('+')
      .setStyle(ButtonStyle.Success)
      .setDisabled(meta.progresso >= meta.meta),
    new ButtonBuilder()
      .setCustomId(`meta_${atividade.nome}_${metaIndex}_down`)
      .setLabel('-')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(meta.progresso <= 0),
    new ButtonBuilder()
      .setCustomId(`meta_${atividade.nome}_${metaIndex}_ajudei`)
      .setLabel('Ajudei 👍')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`meta_${atividade.nome}_${metaIndex}_retirarajuda`)
      .setLabel('Retirar Ajuda 👎')
      .setStyle(ButtonStyle.Secondary)
  );
}

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand() && interaction.commandName === 'atividade') {
    const modal = new ModalBuilder()
      .setCustomId('modal_criar_atividade')
      .setTitle('📝 Criar nova Atividade');

    const nome = new TextInputBuilder()
      .setCustomId('nome')
      .setLabel('Nome da Atividade')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const descricao = new TextInputBuilder()
      .setCustomId('descricao')
      .setLabel('Descrição')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const metas = new TextInputBuilder()
      .setCustomId('metas')
      .setLabel('Metas (uma por linha - Nome=Qtd)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setPlaceholder('Ex:\nRecipe Composite=2\nKey Blade=3');

    modal.addComponents(
      new ActionRowBuilder().addComponents(nome),
      new ActionRowBuilder().addComponents(descricao),
      new ActionRowBuilder().addComponents(metas)
    );

    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'modal_criar_atividade') {
    const nome = interaction.fields.getTextInputValue('nome').trim();
    const descricao = interaction.fields.getTextInputValue('descricao').trim();
    const metasTexto = interaction.fields.getTextInputValue('metas').trim();

    if (data.atividades.some(a => a.nome.toLowerCase() === nome.toLowerCase())) {
      await interaction.reply({ content: '❌ Já existe uma atividade com esse nome.', ephemeral: true });
      return;
    }

    const metas = metasTexto.split('\n').map(str => {
      const [nomeMeta, qtd] = str.split('=').map(s => s.trim());
      return {
        nome: nomeMeta,
        meta: parseInt(qtd, 10),
        progresso: 0,
        messageId: null,
        contribuicoes: {},
      };
    });

    const atividade = { nome, descricao, metas };
    data.atividades.push(atividade);
    saveData();

    await interaction.reply({ content: `🎯 **Atividade criada:** ${atividade.nome}`, ephemeral: true });

    for (let i = 0; i < metas.length; i++) {
      const msg = await interaction.channel.send({
        embeds: [createMetaEmbed(atividade, i)],
        components: [createMetaButtonRow(atividade, i)],
      });
      atividade.metas[i].messageId = msg.id;
    }

    saveData();
  }

  // Botão interativo
  if (interaction.isButton()) {
    const [prefix, atividadeNome, metaIndexStr, action] = interaction.customId.split('_');
    if (prefix !== 'meta') return;

    const metaIndex = parseInt(metaIndexStr, 10);
    const atividade = data.atividades.find(a => a.nome === atividadeNome);
    if (!atividade) return;

    const meta = atividade.metas[metaIndex];
    const userTag = interaction.user.tag;
    meta.contribuicoes[userTag] = meta.contribuicoes[userTag] || { progresso: 0, ajuda: 0 };

    if (action === 'up') {
      if (meta.progresso < meta.meta) {
        meta.progresso++;
        meta.contribuicoes[userTag].progresso++;
      }
    } else if (action === 'down') {
      const userContrib = meta.contribuicoes[userTag];
      if (userContrib.progresso > 0 && meta.progresso > 0) {
        meta.progresso--;
        userContrib.progresso--;
        if (userContrib.progresso === 0 && userContrib.ajuda === 0) {
          delete meta.contribuicoes[userTag];
        }
      } else {
        await interaction.reply({ content: '❌ Você não tem progresso para remover.', ephemeral: true });
        return;
      }
    } else if (action === 'ajudei') {
      meta.contribuicoes[userTag].ajuda++;
    } else if (action === 'retirarajuda') {
      if (meta.contribuicoes[userTag].ajuda > 0) {
        meta.contribuicoes[userTag].ajuda--;
        if (meta.contribuicoes[userTag].ajuda === 0 && meta.contribuicoes[userTag].progresso === 0) {
          delete meta.contribuicoes[userTag];
        }
      } else {
        await interaction.reply({ content: '❌ Você não tem ajuda registrada para remover.', ephemeral: true });
        return;
      }
    }

    saveData();

    try {
      const msg = await interaction.channel.messages.fetch(meta.messageId);
      await msg.edit({
        embeds: [createMetaEmbed(atividade, metaIndex)],
        components: [createMetaButtonRow(atividade, metaIndex)],
      });
    } catch (error) {
      console.error('Erro ao atualizar mensagem:', error);
    }

    await interaction.deferUpdate();
  }
});

client.login(TOKEN);
