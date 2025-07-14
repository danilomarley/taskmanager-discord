// utils/postarAtividade.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { saveData } = require('../database');

async function postarAtividade(channel, atividade, client = null) {
  // Apagar mensagens antigas da atividade
  if (atividade.messageIds?.length && atividade.channelId && client) {
    try {
      const canal = await client.channels.fetch(atividade.channelId);
      for (const id of atividade.messageIds) {
        try {
          const msg = await canal.messages.fetch(id);
          await msg.delete();
        } catch (err) {
          console.warn(`⚠️ Falha ao deletar mensagem ${id}:`, err.message);
        }
      }
    } catch (err) {
      console.warn(`⚠️ Não foi possível acessar o canal para apagar mensagens:`, err.message);
    }
  }

  atividade.messageIds = [];
  atividade.channelId = channel.id;

  // Mensagem inicial com nome e descrição
  const embedIntro = new EmbedBuilder()
    .setTitle(`📘 ${atividade.nome}`)
    .setDescription(`📝 ${atividade.descricao || 'Sem descrição'}`)
    .setColor('DarkBlue');

  const introMsg = await channel.send({ embeds: [embedIntro] });
  atividade.messageIds.push(introMsg.id);

  // Enviar uma mensagem para cada meta
  for (let i = 0; i < atividade.metas.length; i++) {
    const meta = atividade.metas[i];

    const contribs = Object.entries(meta.contribuidores || {})
      .map(([id, qtd]) => `<@${id}> (${qtd})`)
      .join(', ') || '*Ninguém ainda*';

    const ajudantes = Object.entries(meta.ajudantes || {})
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

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_${atividade.id}_${i}_plus`)
        .setLabel('+')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`btn_${atividade.id}_${i}_minus`)
        .setLabel('-')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`btn_${atividade.id}_${i}_ajudei`)
        .setLabel('Ajudei 👍')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`btn_${atividade.id}_${i}_unajudei`)
        .setLabel('Tirar Ajuda 👎')
        .setStyle(ButtonStyle.Secondary)
    );

    
    const msg = await channel.send({ embeds: [embed], components: [row] });
    atividade.messageIds.push(msg.id);
  }

  saveData();
  return atividade.messageIds;
}

module.exports = { postarAtividade };
