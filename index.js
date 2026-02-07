const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionFlagsBits,
    REST,
    Routes,
    SlashCommandBuilder,
    Events
} = require('discord.js');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ] 
});

// --- AYARLAR ---
const TOKEN = 'MTQ2OTYwODI3NzA3MDU4MTg0MQ.GG_EK0.5Jg8d5R94C7fOFP4T7DMjTud5eUSMZBGiF8fjo';
const REHBER_ROL_ID = '1469424531851448321';
const AAC_ROL_ID = '1469331584720179346';
const YETKILI_ROL_ID = '1469330143922225183';
const YETKILI_ROLLER = [YETKILI_ROL_ID, REHBER_ROL_ID, AAC_ROL_ID];

const KATEGORILER = {
    basvuru: '1469616918074884258',
    hile_bildirim: '1469616998311788725',
    hile_itiraz: '1469617082508247091',
    sikayet: '1469617161650835530',
    kontrol: '1469617232479911946'
};

// --- KOMUT KAYITLARI ---
const commands = [
    new SlashCommandBuilder().setName('istatistik').setDescription('Haftalık yetkili performansını gösterir.'),
    new SlashCommandBuilder().setName('talep-al').setDescription('Talebi üzerinize alırsınız.'),
    new SlashCommandBuilder().setName('talep-kapat').setDescription('Talebi kapatma işlemini başlatır.'),
    new SlashCommandBuilder().setName('kur').setDescription('Destek sistemini kurar (Yalnızca Admin).'),
    new SlashCommandBuilder().setName('talep-devret').setDescription('Talebi başka bir yetkiliye devreder.')
        .addUserOption(option => option.setName('yetkili').setDescription('Devredilecek kişi').setRequired(true)),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

// --- VERİLER ---
let db = { haftalik: {}, toplam: {} };
let ticketCounter = 1415;

function statEkle(userId, tip) {
    if (!db.haftalik[userId]) db.haftalik[userId] = { ustlenilen: 0, kapatilan: 0 };
    db.haftalik[userId][tip]++;
}

client.once(Events.ClientReady, async (c) => {
    console.log(`✅ ${c.user.tag} aktif! çalışıyor.`);
    try {
        await rest.put(Routes.applicationCommands(c.user.id), { body: commands });
        console.log('🚀 Slash (/) komutları başarıyla güncellendi.');
    } catch (error) { console.error("Yükleme Hatası:", error); }
});

client.on(Events.InteractionCreate, async (interaction) => {
    // 1. TICKET OLUŞTURMA (MENÜ)
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        ticketCounter++;
        const kategoriKey = interaction.values[0];
        const kategoriIsmi = kategoriKey.charAt(0).toUpperCase() + kategoriKey.slice(1).replace('_', ' ');

        try {
            const channel = await interaction.guild.channels.create({
                name: `${kategoriKey}-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: KATEGORILER[kategoriKey],
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                    { id: YETKILI_ROL_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: REHBER_ROL_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: AAC_ROL_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                ],
            });

            const welcomeEmbed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('🚀 Destek Talebi Açıldı')
                .addFields(
                    { name: '📋 Ticket ID', value: `\`TICKET-${ticketCounter}\``, inline: true },
                    { name: '📂 Kategori', value: `⚖️ ${kategoriIsmi}`, inline: true },
                    { name: '👤 Talep Sahibi', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setFooter({ text: 'Yetkilinin gelmesini bekleyiniz.' }).setTimestamp();

            await channel.send({ content: `<@&${YETKILI_ROL_ID}>`, embeds: [welcomeEmbed] });
            await interaction.reply({ content: `✅ Talebiniz oluşturuldu: ${channel}`, ephemeral: true });
        } catch (e) { console.error(e); }
    }

    // 2. BUTONLAR
    if (interaction.isButton()) {
        if (interaction.customId === 'ticket_delete') {
            statEkle(interaction.user.id, 'kapatilan');
            await interaction.reply("🔒 Kanal siliniyor...");
            setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
        }
        if (interaction.customId === 'ticket_reopen') await interaction.message.delete().catch(() => {});
    }

    // 3. SLASH KOMUTLARI
    if (!interaction.isChatInputCommand()) return;

    // --- /kur KOMUTU (GELİŞMİŞ EMBED) ---
    if (interaction.commandName === 'kur') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) 
            return interaction.reply({ content: "Yetkiniz yok!", ephemeral: true });

        const ticketEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🎫 PortalCraft Destek Merkezi')
            .setDescription('Aşağıdaki menüden ihtiyacınız olan kategoriyi seçerek destek talebi oluşturabilirsiniz.\n\n📝 **Başvuru**\n🚨 **Hile Bildirim**\n⚖️ **Hile İtiraz**\n📢 **Şikayet**\n✅ **Kontrol**')
            .setFooter({ text: 'PortalCraft Destek Sistemi' });

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_select')
                .setPlaceholder('Bir kategori seçin...')
                .addOptions([
                    { label: 'Başvuru', value: 'basvuru', emoji: '📝' },
                    { label: 'Hile Bildirim', value: 'hile_bildirim', emoji: '🚨' },
                    { label: 'Hile İtiraz', value: 'hile_itiraz', emoji: '⚖️' },
                    { label: 'Şikayet', value: 'sikayet', emoji: '📢' },
                    { label: 'Kontrol', value: 'kontrol', emoji: '✅' }
                ])
        );

        await interaction.channel.send({ embeds: [ticketEmbed], components: [menu] });
        await interaction.reply({ content: '✅ Destek sistemi kuruldu!', ephemeral: true });
    }

    if (interaction.commandName === 'talep-al') {
        if (!interaction.member.roles.cache.some(r => YETKILI_ROLLER.includes(r.id))) return interaction.reply("Yetkiniz yok!");
        await interaction.channel.permissionOverwrites.edit(interaction.user.id, { SendMessages: true });
        for (const rID of YETKILI_ROLLER) await interaction.channel.permissionOverwrites.edit(rID, { SendMessages: false }).catch(() => {});
        statEkle(interaction.user.id, 'ustlenilen');
        await interaction.reply(`✅ Talep ${interaction.user} tarafından üstlenildi.`);
    }

    if (interaction.commandName === 'istatistik') {
        const sirali = Object.entries(db.haftalik).sort(([,a],[,b]) => b.ustlenilen - a.ustlenilen).slice(0, 10);
        const embed = new EmbedBuilder().setTitle("📊 Performans").setColor("Aqua")
            .setDescription(sirali.length ? sirali.map(([id, d], i) => `**${i+1}.** <@${id}> - Üstlenme: \`${d.ustlenilen}\``).join('\n') : "Veri yok.");
        await interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'talep-kapat') {
        if (!interaction.member.roles.cache.some(r => YETKILI_ROLLER.includes(r.id))) return interaction.reply("Yetkiniz yok!");
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_reopen').setLabel('İptal').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket_delete').setLabel('SİL').setStyle(ButtonStyle.Danger)
        );
        await interaction.reply({ content: "⚠️ Talebi kapatmak istiyor musunuz?", components: [row] });
    }

    if (interaction.commandName === 'talep-devret') {
        const hedef = interaction.options.getMember('yetkili');
        await interaction.channel.permissionOverwrites.edit(hedef.id, { ViewChannel: true, SendMessages: true });
        await interaction.channel.permissionOverwrites.edit(interaction.user.id, { SendMessages: false });
        await interaction.reply(`🔄 Talep ${hedef} yetkilisine devredildi.`);
    }
});

client.login(TOKEN);