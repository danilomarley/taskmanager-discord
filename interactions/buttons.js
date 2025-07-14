// buttons.js
const { data, saveData } = require('../database');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  async execute(interaction) {
    if (!interaction.isButton()) return;

    const match = interaction.customId.match(/^btn_(.+)_(\d+)_(plus|minus|ajudei|unajudei)$/);
    if (!match) return;

    const [ , atividadeId, metaIndexStr, action ] = match;
    const metaIndex = parseInt(metaIndexStr, 10);
    const userId = interaction.user.id;

    const atividade = data.atividades.find(a => a.id === atividadeId);
    if (!atividade) {
      return interaction.reply({ content: '❌ Atividade não encontrada.', ephemeral: true });
    }

    const meta = atividade.metas[metaIndex];
    if (!meta) {
      return interaction.reply({ content: '❌ Meta não encontrada.', ephemeral: true });
    }

    meta.contribuidores ??= {};
    meta.ajudantes ??= {};

    // Ações
    if (action === 'plus') {
      if (meta.progresso >= meta.meta) {
        return interaction.reply({ content: '✅ Essa meta já foi concluída!', ephemeral: true });
      }

      if ((meta.ajudantes[userId] || 0) > 0) {
        return interaction.reply({ content: '⚠️ Você marcou ajuda, não pode progredir essa meta.', ephemeral: true });
      }

      meta.progresso++;
      meta.contribuidores[userId] = (meta.contribuidores[userId] || 0) + 1;

    } else if (action === 'minus') {
      const userProgress = meta.contribuidores[userId] || 0;

      if (userProgress <= 0 || meta.progresso <= 0) {
        return interaction.reply({ content: '❌ Você não tem progresso para remover nessa meta.', ephemeral: true });
      }

      meta.progresso--;
      meta.contribuidores[userId]--;

      if (meta.contribuidores[userId] === 0) {
        delete meta.contribuidores[userId];
      }

    } else if (action === 'ajudei') {
      meta.ajudantes[userId] = (meta.ajudantes[userId] || 0) + 1;

    } else if (action === 'unajudei') {
      if (!meta.ajudantes[userId]) {
        return interaction.reply({ content: '❌ Você ainda não marcou ajuda nessa meta.', ephemeral: true });
      }

      meta.ajudantes[userId]--;
      if (meta.ajudantes[userId] === 0) {
        delete meta.ajudantes[userId];
      }
    }

    // Atualiza embed
    const contribs = Object.entries(meta.contribuidores)
      .map(([id, qtd]) => `<@${id}> (${qtd})`)
      .join(', ') || '*Ninguém ainda*';

    const ajudantes = Object.entries(meta.ajudantes)
      .map(([id, qtd]) => `<@${id}> (${qtd})`)
      .join(', ') || '*Ninguém ainda*';

    const embed = new EmbedBuilder()
      .setTitle(`📌 ${meta.nome}`)
      .setDescription(`🎯 Progresso: ${meta.progresso}/${meta.meta}`)
      .addFields(
        { name: '👥 Contribuições', value: contribs, inline: false },
        { name: '🤝 Ajuda', value: ajudantes, inline: false }
      )
      .setColor(meta.progresso >= meta.meta ? 'Blue' : 'Green');

    await interaction.update({ embeds: [embed] });

    saveData();
  }
};