// What the Levites sing, verse by verse: the psalm of the day (Tamid 7:4), the Shabbat afternoon song and Ha'azinu
// for the Shabbat musaf (Rosh HaShanah 31a), each divided into the three sections of the libation concert
// ("they reached a section: they blew, and the people prostrated" — Tamid 7:3). Pure data + helpers, shared by the main
// thread (captions, libationTimeline) and the synthesis Worker (the text the choir sings).
//
// Hebrew and the chant syllables: songs-text.js (generated from the Leningrad Codex by dev/make-songs.mjs).
// English: our own plain rendering, close to the Hebrew (not a published translation). Divine Names: "the Lord" for
// the Tetragrammaton (and Yah, Adonai), "God" for Elohim and El — as the captions' Hebrew writes them ה׳ / אֱלֹקִים / קֵל.
//
// Sections (docs/decisions/audio-2-fix.md): the Mishnah fixes three sections, not where they break. Psalms: the first
// audio version's section starts kept (it sang "the opening verses of each third"): about equal thirds by verse count.
// Most breaks also fall at a sense break, but three do not: 24:3|4 parts the question "who may go up the mountain of
// the Lord?" from its answer, 48:5|6 cuts the kings' story (5–8), 82:3|4 the paired commands (3–4). The songs: each
// week's unit (Rashi on RH 31a: "Az yashir" to "Mi chamocha", "Mi chamocha" to the end of the song, the Song of the
// Well; Ha'azinu in Rambam's six, Tefillah 13:5 — the synagogue division the Gemara equates with the musaf's) in three
// sense units of about equal length.
//
// Also the bikkurim song, Psalm 30 ('aromimcha'): "they reached the court, and the Levites spoke in song: 'I will exalt
// You, O Lord, for You have drawn me up…'" (Bikkurim 3:4; Rambam Bikkurim 4:17 quotes the verse and "etc."). Not a
// concert: its three sections are only how it is cued (sense breaks 4|5, 8|9); a choreography sings them back to back.
import { HEB } from './songs-text.js';

/** English, by verse key. */
export const EN = {
  'Ps 24:1': 'Of David, a psalm. The earth and all that fills it are the Lord\'s, the world and those who live in it.',
  'Ps 24:2': 'For He founded it upon the seas, and set it firm upon the rivers.',
  'Ps 24:3': 'Who may go up the mountain of the Lord, and who may stand in His holy place?',
  'Ps 24:4': 'One with clean hands and a pure heart, who has not sworn by My life in vain, nor sworn to deceive.',
  'Ps 24:5': 'He will carry away a blessing from the Lord, and righteousness from the God who saves him.',
  'Ps 24:6': 'This is the generation of those who seek Him; those who seek Your presence are Jacob. Selah.',
  'Ps 24:7': 'Lift up your heads, O gates, and be lifted up, you everlasting doors, that the King of glory may come in.',
  'Ps 24:8': 'Who is this King of glory? The Lord, strong and mighty; the Lord, mighty in battle.',
  'Ps 24:9': 'Lift up your heads, O gates, lift them up, you everlasting doors, that the King of glory may come in.',
  'Ps 24:10': 'Who is He, this King of glory? The Lord of hosts — He is the King of glory. Selah.',

  'Ps 48:1': 'A song, a psalm of the sons of Korach.',
  'Ps 48:2': 'Great is the Lord and highly praised, in the city of our God, His holy mountain.',
  'Ps 48:3': 'Beautiful in its height, the joy of the whole earth, is Mount Zion, at the far reaches of the north, the city of the great King.',
  'Ps 48:4': 'God, in its palaces, is known as a stronghold.',
  'Ps 48:5': 'For see — the kings assembled; they came on together.',
  'Ps 48:6': 'They saw, and they were astounded; they were terrified and fled in haste.',
  'Ps 48:7': 'Trembling seized them there, pangs like a woman in labor,',
  'Ps 48:8': 'as with the east wind You shatter the ships of Tarshish.',
  'Ps 48:9': 'As we have heard, so have we seen in the city of the Lord of hosts, in the city of our God; God will establish it forever. Selah.',
  'Ps 48:10': 'We have meditated on Your kindness, O God, in the midst of Your Temple.',
  'Ps 48:11': 'As Your name is, O God, so is Your praise, to the ends of the earth; Your right hand is full of righteousness.',
  'Ps 48:12': 'Let Mount Zion rejoice, let the daughters of Judah be glad, because of Your judgments.',
  'Ps 48:13': 'Walk around Zion, go all about her; count her towers.',
  'Ps 48:14': 'Mark well her ramparts, go through her palaces, so that you may tell it to a later generation.',
  'Ps 48:15': 'For this is God, our God, forever and ever; He will guide us until death.',

  'Ps 82:1': 'A psalm of Asaf. God stands in the assembly of God; in the midst of the judges He judges.',
  'Ps 82:2': 'How long will you judge unjustly and show favor to the wicked? Selah.',
  'Ps 82:3': 'Do justice for the poor and the orphan; vindicate the lowly and the destitute.',
  'Ps 82:4': 'Rescue the poor and the needy; save them from the hand of the wicked.',
  'Ps 82:5': 'They do not know and do not understand; they walk about in darkness; all the foundations of the earth are shaken.',
  'Ps 82:6': 'I had said: You are godlike, sons of the Most High, all of you.',
  'Ps 82:7': 'But you shall die as men die, and fall like any one of the princes.',
  'Ps 82:8': 'Arise, O God, judge the earth, for all the nations are Your possession.',

  'Ps 94:1': 'God of retribution, O Lord, God of retribution — shine forth!',
  'Ps 94:2': 'Rise up, Judge of the earth; give the proud what they deserve.',
  'Ps 94:3': 'How long shall the wicked, O Lord, how long shall the wicked exult?',
  'Ps 94:4': 'They pour out insolent words; all the evildoers boast.',
  'Ps 94:5': 'They crush Your people, O Lord, and afflict Your inheritance.',
  'Ps 94:6': 'They kill the widow and the stranger, and murder the orphans.',
  'Ps 94:7': 'And they say: The Lord does not see; the God of Jacob pays no heed.',
  'Ps 94:8': 'Understand, you senseless among the people! You fools, when will you grow wise?',
  'Ps 94:9': 'He who planted the ear — shall He not hear? He who formed the eye — shall He not see?',
  'Ps 94:10': 'He who disciplines nations — shall He not punish, He who teaches man knowledge?',
  'Ps 94:11': 'The Lord knows the thoughts of man, that they are a passing breath.',
  'Ps 94:12': 'Happy is the man whom You discipline, O Lord, and teach from Your Torah,',
  'Ps 94:13': 'to give him rest from days of evil, until a pit is dug for the wicked.',
  'Ps 94:14': 'For the Lord will not abandon His people, nor forsake His inheritance.',
  'Ps 94:15': 'For judgment shall return to righteousness, and all the upright in heart shall follow it.',
  'Ps 94:16': 'Who will rise up for me against the wicked? Who will take a stand for me against the evildoers?',
  'Ps 94:17': 'Had the Lord not been my help, my soul would soon have dwelt in silence.',
  'Ps 94:18': 'When I said, My foot is slipping, Your kindness, O Lord, held me up.',
  'Ps 94:19': 'When my troubled thoughts multiply within me, Your comforts delight my soul.',
  'Ps 94:20': 'Can the throne of ruin be Your ally, which frames injustice into law?',
  'Ps 94:21': 'They band together against the life of the righteous, and condemn innocent blood.',
  'Ps 94:22': 'But the Lord has been my stronghold, and my God the rock of my refuge.',
  'Ps 94:23': 'He turns their own iniquity back upon them, and cuts them off through their own evil; the Lord our God will cut them off.',

  'Ps 81:1': 'For the conductor, on the gittit, of Asaf.',
  'Ps 81:2': 'Sing out to God our strength; shout for joy to the God of Jacob.',
  'Ps 81:3': 'Raise a song and sound the drum, the sweet kinnor with the nevel.',
  'Ps 81:4': 'Blow the shofar at the new moon, at the time the moon is covered, for our festival day.',
  'Ps 81:5': 'For it is a statute for Israel, a law of the God of Jacob.',
  'Ps 81:6': 'He set it as a testimony in Joseph when he went out over the land of Egypt; a language I did not know I heard.',
  'Ps 81:7': 'I removed his shoulder from the burden; his hands were freed from the basket.',
  'Ps 81:8': 'In distress you called, and I rescued you; I answered you from the hiding place of thunder; I tested you at the waters of Merivah. Selah.',
  'Ps 81:9': 'Hear, My people, and I will warn you; Israel, if only you would listen to Me!',
  'Ps 81:10': 'Let there be no strange god among you, and do not bow down to a foreign god.',
  'Ps 81:11': 'I am the Lord your God, who brought you up from the land of Egypt; open your mouth wide, and I will fill it.',
  'Ps 81:12': 'But My people did not listen to My voice, and Israel would have none of Me.',
  'Ps 81:13': 'So I let them go after the stubbornness of their hearts; they walk in their own counsels.',
  'Ps 81:14': 'If only My people would listen to Me, if Israel would walk in My ways,',
  'Ps 81:15': 'I would soon subdue their enemies and turn My hand against their foes.',
  'Ps 81:16': 'Those who hate the Lord would cower before Him, and their time would be forever.',
  'Ps 81:17': 'He would feed them with the finest of the wheat, and with honey from the rock I would satisfy you.',

  'Ps 93:1': 'The Lord reigns, He is robed in majesty; the Lord is robed, girded with strength; the world stands firm, it cannot be moved.',
  'Ps 93:2': 'Your throne stands firm from of old; You are from everlasting.',
  'Ps 93:3': 'The rivers have lifted up, O Lord, the rivers have lifted up their voice; the rivers lift up their pounding waves.',
  'Ps 93:4': 'Above the sound of many waters, the mighty breakers of the sea, the Lord on high is mighty.',
  'Ps 93:5': 'Your testimonies are most faithful; holiness befits Your House, O Lord, for length of days.',

  'Ps 92:1': 'A psalm, a song for the Shabbat day.',
  'Ps 92:2': 'It is good to give thanks to the Lord, and to sing praise to Your name, Most High,',
  'Ps 92:3': 'to tell of Your kindness in the morning, and of Your faithfulness in the nights,',
  'Ps 92:4': 'on the ten-stringed instrument and on the nevel, with a melody on the kinnor.',
  'Ps 92:5': 'For You have made me glad, O Lord, by what You have done; at the works of Your hands I sing for joy.',
  'Ps 92:6': 'How great are Your works, O Lord; Your thoughts are very deep.',
  'Ps 92:7': 'A boor does not know, and a fool does not understand this:',
  'Ps 92:8': 'when the wicked spring up like grass and all the evildoers flourish, it is that they may be destroyed forever.',
  'Ps 92:9': 'But You, O Lord, are on high forever.',
  'Ps 92:10': 'For see, Your enemies, O Lord — for see, Your enemies will perish; all the evildoers will be scattered.',
  'Ps 92:11': 'You have raised my horn like the wild ox\'s; I am anointed with fresh oil.',
  'Ps 92:12': 'My eye has seen the fall of those who lie in wait for me; my ears have heard of the evildoers who rose against me.',
  'Ps 92:13': 'The righteous will flourish like the palm tree; he will grow tall like a cedar in Lebanon.',
  'Ps 92:14': 'Planted in the House of the Lord, they will flourish in the courts of our God.',
  'Ps 92:15': 'They will still bear fruit in old age; they will stay full of sap and fresh,',
  'Ps 92:16': 'to declare that the Lord is upright — my Rock, in whom there is no wrong.',

  'Ex 15:1': 'Then Moses and the children of Israel sang this song to the Lord, and said: I will sing to the Lord, for He is highly exalted; horse and rider He has hurled into the sea.',
  'Ex 15:2': 'The Lord is my strength and my song, and He has become my salvation; this is my God, and I will glorify Him, the God of my father, and I will exalt Him.',
  'Ex 15:3': 'The Lord is a man of war; the Lord is His name.',
  'Ex 15:4': 'Pharaoh\'s chariots and his army He cast into the sea; his chosen officers sank in the Sea of Reeds.',
  'Ex 15:5': 'The deeps covered them; they went down into the depths like a stone.',
  'Ex 15:6': 'Your right hand, O Lord, glorious in power — Your right hand, O Lord, shatters the enemy.',
  'Ex 15:7': 'In the greatness of Your majesty You overthrow those who rise against You; You send out Your fury, it consumes them like straw.',
  'Ex 15:8': 'At the breath of Your nostrils the waters were heaped up; the streams stood upright like a wall; the deeps congealed in the heart of the sea.',
  'Ex 15:9': 'The enemy said: I will pursue, I will overtake, I will divide the spoil; my desire shall have its fill of them; I will draw my sword, my hand shall destroy them.',
  'Ex 15:10': 'You blew with Your wind, the sea covered them; they sank like lead in the mighty waters.',
  'Ex 15:11': 'Who is like You among the mighty, O Lord? Who is like You, glorious in holiness, awesome in praises, doing wonders?',
  'Ex 15:12': 'You stretched out Your right hand — the earth swallowed them.',
  'Ex 15:13': 'In Your kindness You led the people You redeemed; in Your strength You guided them to Your holy dwelling.',
  'Ex 15:14': 'Peoples heard, they trembled; anguish took hold of those who dwell in Philistia.',
  'Ex 15:15': 'Then the chiefs of Edom were dismayed; trembling seized the mighty of Moav; all who dwell in Canaan melted away.',
  'Ex 15:16': 'Terror and dread fall upon them; by the greatness of Your arm they are still as stone, until Your people pass over, O Lord, until the people You acquired pass over.',
  'Ex 15:17': 'You will bring them and plant them on the mountain of Your inheritance, the place You made for Your dwelling, O Lord — the Sanctuary, O Lord, that Your hands established.',
  'Ex 15:18': 'The Lord shall reign forever and ever.',

  'Nu 21:17': 'Then Israel sang this song: Spring up, O well — sing to it!',
  'Nu 21:18': 'The well that princes dug, that the nobles of the people delved, with the scepter, with their staffs. And from the wilderness, to Mattanah;',
  'Nu 21:19': 'and from Mattanah to Nachaliel, and from Nachaliel to Bamot;',
  'Nu 21:20': 'and from Bamot to the valley in the field of Moav, at the top of the Pisgah, which looks down upon the wasteland.',

  'Dt 32:1': 'Give ear, O heavens, and I will speak; and let the earth hear the words of my mouth.',
  'Dt 32:2': 'May my teaching drop like the rain, my word flow down like the dew, like fine showers on the grass and like drops of rain on the herbs.',
  'Dt 32:3': 'For I proclaim the name of the Lord; give greatness to our God.',
  'Dt 32:4': 'The Rock — His work is perfect, for all His ways are justice; a faithful God, without wrong, righteous and upright is He.',
  'Dt 32:5': 'The corruption is not His: the blemish is His children\'s — a crooked and twisted generation.',
  'Dt 32:6': 'Is this how you repay the Lord, you foolish people, and unwise? Is He not your Father, who acquired you? He made you and set you firm.',
  'Dt 32:7': 'Remember the days of old, consider the years of every generation; ask your father and he will tell you, your elders and they will say it to you.',
  'Dt 32:8': 'When the Most High gave the nations their inheritance, when He divided the children of man, He set the borders of the peoples according to the number of the children of Israel.',
  'Dt 32:9': 'For the Lord\'s portion is His people; Jacob is the lot of His inheritance.',
  'Dt 32:10': 'He found him in a desert land, in an empty, howling waste; He surrounded him, He gave him understanding, He guarded him like the pupil of His eye.',
  'Dt 32:11': 'Like an eagle that stirs up its nest and hovers over its young, He spread His wings, took him up, and carried him on His pinions.',
  'Dt 32:12': 'The Lord alone led him, and there was no foreign god with Him.',
  'Dt 32:13': 'He made him ride upon the heights of the earth, and he ate the produce of the field; He nursed him with honey from the crag and oil from the flinty rock,',
  'Dt 32:14': 'curds of the herd and milk of the flock, with the fat of lambs, and rams of Bashan\'s breed, and goats, with the choicest of wheat; and you drank the blood of the grape, foaming wine.',
  'Dt 32:15': 'Yeshurun grew fat and kicked — you grew fat, you grew thick, you were gorged — and he forsook God who made him, and spurned the Rock of his salvation.',
  'Dt 32:16': 'They roused His jealousy with strange gods; with abominations they angered Him.',
  'Dt 32:17': 'They sacrificed to demons, no-gods, to gods they had not known, new ones come lately, whom your fathers did not dread.',
  'Dt 32:18': 'The Rock who bore you, you neglected, and you forgot God who brought you forth.',
  'Dt 32:19': 'The Lord saw and spurned them, provoked by His sons and His daughters.',
  'Dt 32:20': 'He said: I will hide My face from them; I will see what their end will be, for they are a perverse generation, children with no faithfulness in them.',
  'Dt 32:21': 'They roused My jealousy with a no-god, angered Me with their empty idols; so I will rouse their jealousy with a no-people, with a foolish nation I will anger them.',
  'Dt 32:22': 'For a fire is kindled in My anger and burns down to the lowest depths; it consumes the earth and its produce, and sets ablaze the foundations of the mountains.',
  'Dt 32:23': 'I will heap evils upon them; I will spend My arrows on them.',
  'Dt 32:24': 'Wasted by hunger, devoured by fever and bitter plague; I will send the teeth of beasts against them, with the venom of things that crawl in the dust.',
  'Dt 32:25': 'Outside the sword bereaves, and within the chambers terror, both young man and maiden, the infant with the man of grey hairs.',
  'Dt 32:26': 'I said: I would scatter them, I would make their memory cease from among men,',
  'Dt 32:27': 'were it not that I dreaded the enemy\'s provocation, lest their foes misread it, lest they say: Our hand is high, and it was not the Lord who did all this.',
  'Dt 32:28': 'For they are a nation void of counsel, and there is no understanding in them.',
  'Dt 32:29': 'Were they wise, they would grasp this; they would understand what their end will be.',
  'Dt 32:30': 'How could one chase a thousand, and two put ten thousand to flight, unless their Rock had sold them and the Lord had given them up?',
  'Dt 32:31': 'For their rock is not like our Rock — our enemies themselves are judges of it.',
  'Dt 32:32': 'For their vine is of the vine of Sodom and of the fields of Gomorrah; their grapes are grapes of poison, their clusters are bitter.',
  'Dt 32:33': 'Their wine is the venom of serpents, the cruel poison of vipers.',
  'Dt 32:34': 'Is this not stored up with Me, sealed up in My treasuries?',
  'Dt 32:35': 'Vengeance and recompense are Mine, for the time their foot slips; for the day of their disaster is near, and what is in store for them hastens on.',
  'Dt 32:36': 'For the Lord will judge His people and relent concerning His servants, when He sees that their strength is gone and none is left, shut in or free.',
  'Dt 32:37': 'He will say: Where are their gods, the rock in which they took refuge,',
  'Dt 32:38': 'who ate the fat of their sacrifices and drank the wine of their libations? Let them rise up and help you; let them be a shelter over you!',
  'Dt 32:39': 'See now that I, I am He, and there is no god beside Me; I put to death and I bring to life; I have wounded and I will heal, and none can rescue from My hand.',
  'Dt 32:40': 'For I lift up My hand to heaven and say: As I live forever,',
  'Dt 32:41': 'when I whet My flashing sword and My hand takes hold of judgment, I will return vengeance to My foes and repay those who hate Me.',
  'Dt 32:42': 'I will make My arrows drunk with blood, and My sword shall devour flesh — with the blood of the slain and the captive, from the head of the enemy\'s leaders.',
  'Dt 32:43': 'Sing aloud, O nations, of His people, for He will avenge the blood of His servants; He will return vengeance to His foes, and atone for His land, His people.',

  // the bikkurim song (Bikkurim 3:4)
  'Ps 30:1': 'A psalm, a song for the dedication of the House, of David.',
  'Ps 30:2': 'I will exalt You, O Lord, for You have drawn me up, and have not let my enemies rejoice over me.',
  'Ps 30:3': 'O Lord my God, I cried out to You, and You healed me.',
  'Ps 30:4': 'O Lord, You brought my soul up from the grave; You kept me alive, that I should not go down to the pit.',
  'Ps 30:5': 'Sing to the Lord, you His devoted ones, and give thanks at the remembrance of His holiness.',
  'Ps 30:6': 'For His anger is but a moment, life is in His favor; weeping may stay the night, but in the morning there is a song of joy.',
  'Ps 30:7': 'And I had said in my ease: I shall never be moved.',
  'Ps 30:8': 'O Lord, by Your favor You made my mountain stand firm; You hid Your face, and I was terrified.',
  'Ps 30:9': 'To You, O Lord, I call, and to the Lord I plead:',
  'Ps 30:10': 'What gain is there in my blood, in my going down to the pit? Will the dust praise You? Will it tell of Your faithfulness?',
  'Ps 30:11': 'Hear, O Lord, and be gracious to me; O Lord, be my helper.',
  'Ps 30:12': 'You have turned my mourning into dancing for me; You have loosed my sackcloth and girded me with joy,',
  'Ps 30:13': 'so that my glory may sing praise to You and not be silent; O Lord my God, I will thank You forever.',
};

const BOOK = {
  Ps: { en: 'Psalm', he: 'תְּהִלִּים' }, Ex: { en: 'Shemot', he: 'שְׁמוֹת' }, Nu: { en: 'Bamidbar', he: 'בְּמִדְבַּר' }, Dt: { en: 'Devarim', he: 'דְּבָרִים' },
};

const psalm = (n, parts, en, he) => ({ kind: 'psalm', psalm: n, ch: `Ps ${n}`, parts, title: { en: `Psalm ${n}`, he: `תְּהִלִּים ${gematria(n)}` }, incipit: { en, he } });
const song = (ch, parts, title, extra) => ({ kind: 'song', ch, parts, title, ...extra });

/**
 * Every song the libation concert can sing: id → { ch ('Ps 24' …), parts: [[first, last] × 3] (verse numbers, the
 * three sections), title {en, he}, … }. Psalms by day (Tamid 7:4); the Shabbat afternoon cycle and Ha'azinu's six
 * (Rosh HaShanah 31a).
 */
export const SONGS = {
  'psalm-24': psalm(24, [[1, 3], [4, 6], [7, 10]], 'Of David, a psalm: the earth and its fullness are the Lord\'s', 'לַה׳ הָאָרֶץ וּמְלוֹאָהּ'),
  'psalm-48': psalm(48, [[1, 5], [6, 9], [10, 15]], 'A song, a psalm of the sons of Korach: great is the Lord and much praised', 'גָּדוֹל ה׳ וּמְהֻלָּל מְאֹד'),
  'psalm-82': psalm(82, [[1, 3], [4, 5], [6, 8]], 'A psalm of Asaf: God stands in the assembly of God', 'אֱלֹקִים נִצָּב בַּעֲדַת קֵל'),
  'psalm-94': psalm(94, [[1, 7], [8, 15], [16, 23]], 'God of retribution', 'קֵל נְקָמוֹת ה׳'),
  'psalm-81': psalm(81, [[1, 6], [7, 11], [12, 17]], 'Sing out to God our strength', 'הַרְנִינוּ לֵאלֹקִים עוּזֵּנוּ'),
  'psalm-93': psalm(93, [[1, 2], [3, 4], [5, 5]], 'The Lord reigns, robed in majesty', 'ה׳ מָלָךְ גֵּאוּת לָבֵשׁ'),
  'psalm-92': psalm(92, [[1, 6], [7, 12], [13, 16]], 'A psalm, a song for the Shabbat day', 'מִזְמוֹר שִׁיר לְיוֹם הַשַּׁבָּת'),
  // Shabbat afternoon (minchah): one each Shabbat, in a three-week cycle (RH 31a; Rashi there)
  'az-yashir': song('Ex 15', [[1, 3], [4, 7], [8, 10]], { en: '"Az yashir" — the Song at the Sea', he: 'אָז יָשִׁיר' }, { when: 'afternoon', week: 0 }),
  'mi-chamocha': song('Ex 15', [[11, 13], [14, 16], [17, 18]], { en: '"Mi chamocha" — the Song at the Sea, to its end', he: 'מִי כָמֹכָה' }, { when: 'afternoon', week: 1 }),
  'az-yashir-yisrael': song('Nu 21', [[17, 17], [18, 18], [19, 20]], { en: '"Az yashir Yisrael" — the Song of the Well', he: 'אָז יָשִׁיר יִשְׂרָאֵל' }, { when: 'afternoon', week: 2 }),
  // Shabbat musaf: Ha'azinu in six, one each Shabbat — הזי"ו ל"ך (RH 31a; Rambam Tefillah 13:5)
  'haazinu-1': song('Dt 32', [[1, 2], [3, 4], [5, 6]], { en: 'Ha\'azinu, section 1 of 6: "Give ear, O heavens"', he: 'הַאֲזִינוּ' }, { when: 'musaf', week: 0 }),
  'haazinu-2': song('Dt 32', [[7, 8], [9, 10], [11, 12]], { en: 'Ha\'azinu, section 2 of 6: "Remember the days of old"', he: 'זְכֹר יְמוֹת עוֹלָם' }, { when: 'musaf', week: 1 }),
  'haazinu-3': song('Dt 32', [[13, 14], [15, 16], [17, 18]], { en: 'Ha\'azinu, section 3 of 6: "He made him ride on the heights"', he: 'יַרְכִּבֵהוּ' }, { when: 'musaf', week: 2 }),
  'haazinu-4': song('Dt 32', [[19, 21], [22, 25], [26, 28]], { en: 'Ha\'azinu, section 4 of 6: "The Lord saw and spurned"', he: 'וַיַּרְא ה׳ וַיִּנְאָץ' }, { when: 'musaf', week: 3 }),
  'haazinu-5': song('Dt 32', [[29, 31], [32, 35], [36, 39]], { en: 'Ha\'azinu, section 5 of 6: "Were they wise"', he: 'לוּ חָכְמוּ' }, { when: 'musaf', week: 4 }),
  'haazinu-6': song('Dt 32', [[40, 41], [42, 42], [43, 43]], { en: 'Ha\'azinu, section 6 of 6: "For I lift up My hand to heaven"', he: 'כִּי אֶשָּׂא אֶל שָׁמַיִם' }, { when: 'musaf', week: 5 }),
  // the first fruits reach the court (Bikkurim 3:4): the whole psalm ⚙ (the Mishnah quotes its second verse, Rambam
  // Bikkurim 4:17 adds "etc."); not one of the daily psalms, so a 'song' (music.js PSALMS and the sim's PSALM_DUR list
  // the daily seven)
  aromimcha: song('Ps 30', [[1, 4], [5, 8], [9, 13]], { en: 'Psalm 30, "I will exalt You, O Lord"', he: 'אֲרוֹמִמְךָ ה׳' }, { when: 'bikkurim', psalm: 30 }),
};
/** other names a song is asked for by: the bikkurim song as Psalm 30 or by its occasion */
export const SONG_ALIAS = { 'psalm-30': 'aromimcha', bikkurim: 'aromimcha' };
export const PSALM_DAYS = [24, 48, 82, 94, 81, 93, 92];   // Tamid 7:4 (Sunday … Shabbat)
export const SHIRAH_CYCLE = ['az-yashir', 'mi-chamocha', 'az-yashir-yisrael'];
export const HAAZINU_CYCLE = ['haazinu-1', 'haazinu-2', 'haazinu-3', 'haazinu-4', 'haazinu-5', 'haazinu-6'];

/** a song name ('haazinu-3', 'az-yashir', 'psalm-92', 92, or 'haazinu' / 'shirah' with week) → its id, or null */
export function resolveSong(song, week = 0) {
  let s = song;
  if (typeof s === 'number' || /^\d+$/.test(s ?? '')) s = `psalm-${+s}`;
  if (typeof s !== 'string') return null;
  s = s.toLowerCase().replace(/[\s_']+/g, '-').replace(/^ha-?azinu/, 'haazinu');
  const wk = Number.isInteger(week) ? week : 0;
  if (s === 'haazinu') s = HAAZINU_CYCLE[((wk % 6) + 6) % 6];
  if (s === 'shirah' || s === 'afternoon') s = SHIRAH_CYCLE[((wk % 3) + 3) % 3];
  s = SONG_ALIAS[s] || s;
  return SONGS[s] ? s : null;
}

/**
 * Canonical song id from libation / cue options: { song } (see resolveSong; a cycle without week takes the week of
 * o.date {y, m, d} as shabbatWeek counts it, else week 0), else { psalm }, else { weekday } (0 = Sunday … 6 = Shabbat).
 * Unknown → 'psalm-48'.
 */
export function songId(o = {}) {
  const s = resolveSong(o.song, Number.isInteger(o.week) ? o.week : o.date ? shabbatWeek(o.date) : 0);
  if (s) return s;
  if (SONGS[`psalm-${o.psalm}`]) return `psalm-${o.psalm}`;
  if (SONGS[SONG_ALIAS[`psalm-${o.psalm}`]]) return SONG_ALIAS[`psalm-${o.psalm}`]; // { psalm: 30 }: the bikkurim song
  if (Number.isInteger(o.weekday) && PSALM_DAYS[o.weekday]) return `psalm-${PSALM_DAYS[o.weekday]}`;
  return 'psalm-48';
}

/** whole weeks since the Shabbat of 2026-01-03 — the cycles' phase as G3/G6 count it (not recorded; ⚙) */
export function shabbatWeek(date) {
  if (!date) return 0;
  return Math.floor(Math.round((Date.UTC(date.y, date.m - 1, date.d) - Date.UTC(2026, 0, 3)) / 86400000) / 7);
}
/** the song for a Shabbat service on a date ({y, m, d}): 'musaf' → Ha'azinu's section, 'afternoon' → the Shirah */
export function shabbatSong(service, date) {
  const w = shabbatWeek(date);
  return service === 'musaf' ? HAAZINU_CYCLE[((w % 6) + 6) % 6] : SHIRAH_CYCLE[((w % 3) + 3) % 3];
}

/** verse keys of a section */
export function sectionRefs(id, section) {
  const S = SONGS[id] || SONGS['psalm-48'];
  const [a, b] = S.parts[Math.max(0, Math.min(2, section | 0))];
  const out = [];
  for (let v = a; v <= b; v++) out.push(`${S.ch}:${v}`);
  return out;
}

/** a section's verses: [{ key, ref: {en, he}, he, en, tr }] */
export function sectionVerses(id, section) {
  return sectionRefs(id, section).map((key) => {
    const [book, cv] = key.split(' ');
    const [c, v] = cv.split(':').map(Number);
    const [he, tr] = HEB[key] || ['', ''];
    return { key, ref: { en: `${BOOK[book].en} ${c}:${v}`, he: `${BOOK[book].he} ${gematria(c)}, ${gematria(v)}` }, he, en: EN[key] || '', tr };
  });
}

/** the chant text of a section (what the Worker sings) */
export function sectionText(id, section) {
  return sectionVerses(id, section).map((v) => v.tr).join(' ');
}

const PART_HE = ['א׳', 'ב׳', 'ג׳'];
/** the heading caption at the start of a section */
export function songHeading(id, section = 0, style) {
  const S = SONGS[id] || SONGS['psalm-48'];
  const k = Math.max(0, Math.min(2, section | 0));
  const [a, b] = S.parts[k];
  const [book, c] = S.ch.split(' ');
  const range = `${BOOK[book].en} ${c}:${a}${b > a ? `–${b}` : ''}`;
  const lens = style === 'sg1612' ? ' — four voices, after Shiltei HaGiborim (1612)' : '';
  if (S.kind === 'psalm') {
    return {
      en: `The Levites sing the song of the day — Psalm ${S.psalm}, "${S.incipit.en}" (part ${k + 1} of 3: ${range}; Tamid 7:3–4)${lens}`,
      he: `שִׁיר שֶׁל יוֹם — ${S.title.he}, פֶּרֶק ${PART_HE[k]}`,
    };
  }
  if (S.when === 'bikkurim') {
    return {
      en: `The first fruits reach the court, and the Levites sing ${S.title.en} (part ${k + 1} of 3: ${range}; Bikkurim 3:4)${lens}`,
      he: `שִׁירַת הַבִּכּוּרִים — תְּהִלִּים ${gematria(S.psalm)}, ${S.title.he}, פֶּרֶק ${PART_HE[k]}`,
    };
  }
  const svc = S.when === 'musaf' ? 'Shabbat musaf' : 'Shabbat afternoon';
  return {
    en: `${svc}: the Levites sing ${S.title.en} (part ${k + 1} of 3: ${range}; Rosh HaShanah 31a)${lens}`,
    he: `${S.when === 'musaf' ? 'שִׁירַת מוּסַף שַׁבָּת' : 'שִׁירַת מִנְחָה בְּשַׁבָּת'} — ${S.title.he}, פֶּרֶק ${PART_HE[k]}`,
  };
}

/** Hebrew numeral (1–399) with geresh / gershayim; 15 and 16 as ט״ו, ט״ז */
export function gematria(n) {
  const H = [[400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק'], [90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'], [50, 'נ'], [40, 'מ'], [30, 'ל'], [20, 'כ'], [10, 'י'], [9, 'ט'], [8, 'ח'], [7, 'ז'], [6, 'ו'], [5, 'ה'], [4, 'ד'], [3, 'ג'], [2, 'ב'], [1, 'א']];
  let s = '', r = n;
  for (const [v, ch] of H) {
    while (r >= v) {
      if (r === 15 || r === 16) { s += r === 15 ? 'טו' : 'טז'; r = 0; break; }
      s += ch; r -= v;
    }
  }
  return s.length > 1 ? `${s.slice(0, -1)}״${s.slice(-1)}` : `${s}׳`;
}
