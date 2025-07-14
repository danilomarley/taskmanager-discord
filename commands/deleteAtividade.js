const {
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const { data, saveData } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete_atividade')
    .setDescription('Deleta uma atividade ou uma meta específica de forma visual'),

  async execute(interaction) {
    if (!data.atividades.length) {
      await interaction.reply({ content: '❌ Nenhuma atividade cadastrada.', ephemeral: true });
      return;
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId('select_atividade_para_deletar')
      .setPlaceholder('Escolha uma atividade para visualizar ou deletar')
      .addOptions(
        data.atividades.map((a, i) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(a.nome)
            .setValue(i.toString())
        )
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({
      content: '🗑️ Selecione uma atividade:',
      components: [row],
      ephemeral: true,
    });
  },

  async handleComponent(interaction) {
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_atividade_para_deletar') {
      await interaction.deferUpdate();

      const index = parseInt(interaction.values[0]);
      const atividade = data.atividades[index];

      const embed = new EmbedBuilder()
        .setTitle(`🗂️ Atividade: ${atividade.nome}`)
        .setDescription(`📝 ${atividade.descricao}`)
        .addFields(atividade.metas.map((m, i) => ({
          name: `${i + 1}. ${m.nome}`,
          value: `Meta: ${m.meta}, Progresso: ${m.progresso}`
        })))
        .setColor('Red');

      const deletarBtn = new ButtonBuilder()
        .setCustomId(`confirm_delete_atividade_${index}`)
        .setLabel('🗑️ Deletar Atividade Inteira')
        .setStyle(ButtonStyle.Danger);

      const menuMetas = new StringSelectMenuBuilder()
        .setCustomId(`delete_meta_from_${index}`)
        .setPlaceholder('Ou selecione uma meta para deletar')
        .addOptions(
          atividade.metas.map((m, i) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(`${i + 1}. ${m.nome}`)
              .setValue(i.toString())
          )
        );

      const row1 = new ActionRowBuilder().addComponents(deletarBtn);
      const row2 = new ActionRowBuilder().addComponents(menuMetas);

      await interaction.editReply({
        content: `O que deseja deletar?`,
        embeds: [embed],
        components: [row1, row2],
      });
    }

    // Confirmação
    if (interaction.isButton() && interaction.customId.startsWith('confirm_delete_atividade_')) {
      const index = parseInt(interaction.customId.split('_').pop());
      const nome = data.atividades[index].nome;

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`delete_atividade_${index}`)
          .setLabel('✅ Sim, deletar')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`cancel_delete`)
          .setLabel('❌ Cancelar')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({
        content: `⚠️ Tem certeza que deseja deletar a atividade **${nome}**?`,
        components: [confirmRow],
        ephemeral: true,
      });
    }

    // Cancelamento
    if (interaction.isButton() && interaction.customId === 'cancel_delete') {
      await interaction.update({
        content: '❎ Ação cancelada.',
        components: [],
      });
    }

    // Deletar atividade inteira
    if (interaction.isButton() && interaction.customId.startsWith('delete_atividade_')) {
      await interaction.deferUpdate();

      const index = parseInt(interaction.customId.split('_').pop());
      const atividade = data.atividades[index];

      // Apagar mensagens se existirem
      if (atividade.messageIds?.length && atividade.channelId) {
        try {
          const canal = await interaction.client.channels.fetch(atividade.channelId);
          for (const msgId of atividade.messageIds) {
            try {
              const msg = await canal.messages.fetch(msgId);
              await msg.delete();
            } catch (e) {
              console.warn(`⚠️ Não foi possível apagar mensagem ${msgId}:`, e.message);
            }
          }
        } catch (e) {
          console.warn('⚠️ Não foi possível acessar o canal da atividade:', e.message);
        }
      }

      const nome = atividade.nome;
      data.atividades.splice(index, 1);
      saveData();

      await interaction.editReply({
        content: `✅ Atividade **${nome}** deletada com sucesso.`,
        embeds: [],
        components: []
      });
    }

    // Deletar meta
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('delete_meta_from_')) {
      await interaction.deferUpdate();

      const [ , , ,idxAtv ] = interaction.customId.split('_');
      const index = parseInt(idxAtv);
      const metaIndex = parseInt(interaction.values[0]);
      const atividade = data.atividades[index];
      const nomeMeta = atividade.metas[metaIndex].nome;

      // Apagar mensagem da meta (índice + 1)
      if (atividade.channelId && atividade.messageIds?.[metaIndex + 1]) {
        try {
          const canal = await interaction.client.channels.fetch(atividade.channelId);
          const msg = await canal.messages.fetch(atividade.messageIds[metaIndex + 1]);
          await msg.delete();

          // Remover do array de mensagens
          atividade.messageIds.splice(metaIndex + 1, 1);
        } catch (err) {
          console.warn(`⚠️ Não foi possível deletar a mensagem da meta:`, err.message);
        }
      }

      // Remover meta
      atividade.metas.splice(metaIndex, 1);

      let mensagem;

      if (atividade.metas.length === 0) {
        // Apagar mensagem de introdução também
        if (atividade.channelId && atividade.messageIds?.[0]) {
          try {
            const canal = await interaction.client.channels.fetch(atividade.channelId);
            const msg = await canal.messages.fetch(atividade.messageIds[0]);
            await msg.delete();
          } catch (e) {
            console.warn(`⚠️ Não foi possível apagar mensagem de introdução:`, e.message);
          }
        }

        data.atividades.splice(index, 1);
        mensagem = `🗑️ Meta removida. Como era a última, a atividade **${atividade.nome}** também foi deletada.`;
      } else {
        mensagem = `✅ Meta **${nomeMeta}** removida com sucesso da atividade **${atividade.nome}**.`;
      }

      saveData();

      await interaction.editReply({
        content: mensagem,
        embeds: [],
        components: []
      });
    }
  }
};