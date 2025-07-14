// commands/atividade.js
const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

const { data, saveData } = require('../database');
const { v4: uuidv4 } = require('uuid');
const { postarAtividade } = require('../utils/postarAtividade');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('atividade')
    .setDescription('Cria uma nova atividade com metas visuais'),

  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('modal_criar_atividade')
      .setTitle('Criar Nova Atividade');

    const nomeInput = new TextInputBuilder()
      .setCustomId('atividade_nome')
      .setLabel('Nome da atividade')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const descricaoInput = new TextInputBuilder()
      .setCustomId('atividade_descricao')
      .setLabel('Descrição (ex: link, local, etc)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const metasInput = new TextInputBuilder()
      .setCustomId('atividade_metas')
      .setLabel('Metas (1 por linha, ex: 0/3 Pegar Espada)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nomeInput),
      new ActionRowBuilder().addComponents(descricaoInput),
      new ActionRowBuilder().addComponents(metasInput)
    );

    await interaction.showModal(modal);
  },

  async handleModal(interaction) {
    if (interaction.customId !== 'modal_criar_atividade') return;

    await interaction.deferReply({ ephemeral: true });

    const nome = interaction.fields.getTextInputValue('atividade_nome');
    const descricao = interaction.fields.getTextInputValue('atividade_descricao');
    const metasText = interaction.fields.getTextInputValue('atividade_metas');

    const metas = metasText.split('\n').map(linha => {
      const match = linha.match(/(\d+)\/(\d+)\s+(.+)/);
      if (match) {
        return {
          progresso: parseInt(match[1], 10),
          meta: parseInt(match[2], 10),
          nome: match[3].trim(),
          contribuidores: {},
          ajudantes: {}
        };
      }
      return null;
    }).filter(Boolean);

    if (metas.length === 0) {
      return await interaction.editReply({ content: '❌ Formato das metas inválido. Use: `0/3 Nome da meta`' });
    }

    const novaAtividade = {
      id: uuidv4(),
      nome,
      descricao,
      metas,
      messageIds: [],
      channelId: null
    };

    // Adiciona atividade ANTES de postar para evitar inconsistência
    data.atividades.push(novaAtividade);
    saveData();

    try {
      // Chamar postarAtividade com os parâmetros na ordem correta
      const messageIds = await postarAtividade(interaction.channel, novaAtividade, interaction.client);

      // Atualizar ids e canal da atividade e salvar
      novaAtividade.messageIds = messageIds;
      novaAtividade.channelId = interaction.channel.id;
      saveData();

      await interaction.editReply({
        content: `✅ Atividade **${nome}** criada com sucesso!`
      });
    } catch (err) {
      console.error('Erro ao postar atividade:', err);
      await interaction.editReply({ content: '❌ Erro ao postar a atividade. Tente novamente.' });
    }
  }
};