// Compatibility dictionary for pages converted from the native mini program.
// New UI should use t() directly; this keeps all legacy screens locale-aware
// while those class components are migrated incrementally.
const EN = {
  '宝批小站': 'PokeChill', '首页': 'Home', '我的': 'My Collection',
  '卡牌': 'Cards', '卡牌总数': 'Total cards', '种': 'unique cards', '张': 'cards',
  '简体中文': 'Simplified Chinese', '繁體中文': 'Traditional Chinese', '简': '简', '繁': '繁',
  '鉴': 'Dex', '猜': '?', '队': 'TM', '属': 'Type', '玩': 'Play', '包': 'Pack', '活': 'Live',
  '任': 'Task', '卡': 'TCG', '宝': 'PKM', '版': 'Ver.', '意': 'Note', '收': 'Fav', '组': 'Deck',
  '宝可梦图鉴': 'Pokédex', '卡牌图鉴': 'TCG Cards', 'Pocket图鉴': 'Pocket Cards',
  'Pocket 卡牌图鉴': 'Pocket Cards', '实体卡牌': 'Physical TCG', '宝可梦': 'Pokémon',
  '搜索': 'Search', '筛选': 'Filters', '搜索与筛选': 'Search & filters', '全部': 'All',
  '搜索宝可梦名称或编号': 'Search Pokémon by name or number',
  '搜索中文名、英文名、日文名或编号': 'Search by Chinese, English or Japanese name or number',
  '搜索实体卡牌、系列或编号': 'Search TCG cards, sets or numbers',
  '搜索 Pocket 卡牌': 'Search Pocket cards',
  '搜索卡牌、宝可梦、系列、编号或画师': 'Search cards, Pokémon, sets, numbers or illustrators',
  '搜索卡牌、宝可梦、扩展包、编号或画师': 'Search cards, Pokémon, expansions, numbers or illustrators',
  '换个名称、编号、属性或地区图鉴试试。': 'Try another name, number, type or regional Pokédex.',
  '换个名称、系列、属性或稀有度试试。': 'Try another name, set, type or rarity.',
  '换个名称、扩展包、编号或稀有度试试。': 'Try another name, expansion, number or rarity.',
  '重置': 'Reset', '清空': 'Clear', '确定': 'Apply', '关闭': 'Close', '排序': 'Sort',
  '编号': 'Number', '名称': 'Name', '稀有度': 'Rarity', '属性': 'Type', '世代': 'Generation',
  '系列': 'Set', '扩展包': 'Expansion', '卡牌类型': 'Card type', '训练家': 'Trainer',
  '加载中': 'Loading', '继续加载中': 'Loading more', '已加载全部': 'All items loaded',
  '加载失败': 'Failed to load', '重新加载': 'Reload', '重试': 'Retry', '请稍后重试': 'Please try again later',
  '暂无': 'None', '暂无数据': 'No data available', '没有找到结果': 'No results found',
  '没有找到卡牌': 'No cards found', '查看详情': 'View details', '进入图鉴': 'Open database',
  '收藏': 'Favorite', '已收藏': 'Favorited', '取消收藏': 'Remove favorite', '☆ 收藏': '☆ Favorite',
  '★ 已收藏': '★ Favorited', '已取消': 'Removed', '愿望单': 'Wishlist', '愿望中': 'Wishlisted',
  '已拥有': 'Owned', '标记拥有': 'Mark as owned', '已标记拥有': 'Marked as owned',
  '标拥有': 'Mark owned', '未添加': 'Not added', '属性关系': 'Type Matchups',
  '已取消拥有': 'Removed from owned', '已加入愿望单': 'Added to wishlist', '已移出愿望单': 'Removed from wishlist',
  '玩法盒子': 'Play', '玩法': 'Play', '常用功能': 'Quick actions', '宝可梦玩法': 'Pokémon tools',
  '实体卡玩法': 'TCG tools', 'Pocket玩法': 'Pocket tools', 'Pocket 玩法': 'Pocket tools',
  '按数据栏目选择轻玩法。': 'Choose tools by data category.',
  '图鉴与属性数据': 'Pokédex and type data', '移动端卡牌数据': 'Mobile card game data',
  '根据属性和世代线索四选一。': 'Choose from four answers using type and generation clues.',
  '维护多个六人队伍，检查共同弱点。': 'Manage multiple teams of six and check shared weaknesses.',
  '快速查看弱点、抗性和免疫。': 'Quickly review weaknesses, resistances and immunities.',
  '根据卡图、系列和稀有度提示作答。': 'Answer using card art, set and rarity clues.',
  '选择实体卡系列并手动开包。': 'Choose a physical TCG set and open a pack manually.',
  '查看当前环境排行榜与完整牌表。': 'View current meta rankings and complete deck lists.',
  '普通包与特典包采用对应抽取规则。': 'Regular and promo packs use their respective pull rules.',
  '查看当前活动、任务和奖励入口。': 'View current events, missions and rewards.',
  '宝可梦猜谜': 'Pokémon Quiz', '每日猜宝可梦': 'Daily Pokémon Quiz', '猜卡牌': 'Card Quiz',
  '猜出这张卡牌': 'Guess the card',
  '今日猜卡牌': 'Today’s Card Quiz', '今日卡牌挑战': 'Today’s Card Challenge', '随机挑战': 'Random challenge',
  '随机 4 选 1': 'Random 1 of 4', '4 选 1': 'Choose 1 of 4', '猜猜这是谁？': 'Who’s that Pokémon?',
  '提示': 'Hint', '再看一个提示': 'Show another hint', '确认答案': 'Confirm answer', '提交答案': 'Submit answer',
  '先选一个答案': 'Choose an answer first', '猜对了': 'Correct!', '猜错了': 'Not quite', '差一点': 'Not quite',
  '再猜一题': 'Next question', '再看一次': 'View again', '查看卡牌': 'View card',
  '队伍': 'Teams', '队伍分析': 'Team Analysis', '多队伍编辑': 'Manage multiple teams',
  '队伍属性分析': 'Team type analysis', '当前队伍': 'Current team', '选择成员': 'Choose members',
  '重命名': 'Rename', '重命名队伍': 'Rename team', '删除': 'Delete', '删除队伍': 'Delete team',
  '主要弱点': 'Main weaknesses', '抗性覆盖': 'Resistance coverage', '免疫覆盖': 'Immunity coverage',
  '暂无明显共同弱点': 'No major shared weaknesses', '暂无抗性覆盖': 'No resistance coverage',
  '暂无免疫覆盖': 'No immunity coverage', '添加宝可梦后显示队伍属性分析': 'Add Pokémon to see team type analysis',
  '点击加入或移除': 'Click to add or remove', '加入队伍': 'Add to team', '看队伍': 'View team',
  '属性速查': 'Type Chart', '属性克制速查': 'Type Matchups', '属性相克表': 'Type Matchup Chart',
  '属性防守': 'Defensive matchups', '相克表': 'Matchup chart', '克制关系': 'Type matchups',
  '纵轴攻击方，横轴防守方': 'Attackers vertically, defenders horizontally', '攻\\防': 'ATK\\DEF',
  '弱点': 'Weakness', '抵抗': 'Resistance', '抗性': 'Resistance', '免疫': 'Immunity',
  '热门卡组': 'Popular Decks', '实体卡热门卡组': 'Popular TCG Decks', '热门 Pocket 卡组': 'Popular Pocket Decks',
  'Pocket 热门卡组': 'Popular Pocket Decks', '卡组详情': 'Deck Details', '卡组全览': 'Deck Overview',
  '排行榜': 'Rankings', '排名': 'Rank', '胜率': 'Win rate', '使用率': 'Usage', '环境占比': 'Meta share',
  '积分': 'Points', '占比': 'Share', '牌表': 'Deck list', '完整牌表': 'Full deck list', '副牌表': 'Sideboard',
  '一键复制卡组': 'Copy deck', '复制完整牌表': 'Copy full deck list', '已复制卡组': 'Deck copied',
  '牌表已复制': 'Deck list copied', '复制失败': 'Copy failed', '暂无可复制牌表': 'No deck list to copy',
  '复制来源': 'Copy source', '已复制来源': 'Source copied', '暂无来源链接': 'No source link',
  '当前环境卡组原型': 'Current meta archetypes', '当前赛制卡组原型': 'Current format archetypes',
  '从当前环境热门原型寻找组牌灵感。': 'Find deck-building inspiration from current meta archetypes.',
  '每日开包': 'Daily Pack', '模拟开包': 'Pack Simulator', 'Pocket 模拟开包': 'Pocket Pack Simulator',
  '开一包': 'Open pack', '开包中': 'Opening pack', '尚未开包': 'No pack opened yet',
  '本包结果': 'Pack results', '卡牌补充包': 'Booster pack', '卡包': 'Pack', '卡池': 'Card pool',
  '每包张数': 'Cards per pack', '抽取规则': 'Pull rules', '普通包': 'Regular pack', '稀有包': 'Rare pack',
  '特典包 · 等概率': 'Promo pack · equal odds', '等概率': 'Equal odds', '5 张一包': '5 cards per pack',
  '选择一个系列后开一包。': 'Choose a set, then open a pack.', '还没有抽包结果': 'No pack results yet',
  '开包失败': 'Failed to open pack', '开包失败，请重试': 'Failed to open pack. Please retry.',
  '活动动态': 'Events', 'Pocket 活动与任务': 'Pocket Events & Missions', '活动': 'Events', '任务': 'Missions',
  '任务与活动': 'Missions & events', '全部活动': 'All events', '当前与预告': 'Current & upcoming',
  '进行中': 'Active', '即将开始': 'Upcoming', '已结束': 'Ended', '长期开放': 'Always available', '长期': 'Ongoing',
  '排位': 'Ranked', '排位赛': 'Ranked matches', '单人战': 'Solo battles', '徽章战': 'Emblem battles',
  '活动商店': 'Event shop', '商店': 'Shop', '得卡挑战': 'Wonder Pick', '免费得卡挑战': 'Free Wonder Pick',
  '吉利蛋挑战': 'Chansey Pick', '宝可金块': 'Poké Gold', '赛事数据': 'Tournament data',
  '赛季': 'Season', '段位': 'Rank', '对战': 'Battle', '对战关卡': 'Battle stages', '完成': 'Complete',
  '内容加载中': 'Loading content', '内容加载失败': 'Failed to load content', '查看内容': 'View content',
  '收起': 'Collapse', '当前栏目暂无内容': 'No content in this section',
  '今日宝可梦': 'Pokémon of the Day', '今日实体卡牌': 'TCG Card of the Day', '今日 Pocket 卡牌': 'Pocket Card of the Day',
  '最近查看': 'Recently viewed', '最近看卡': 'Recently viewed cards', '还没有浏览记录': 'No viewing history yet',
  '还没有看过实体卡牌': 'No TCG cards viewed yet', '还没有看过 Pocket 卡牌': 'No Pocket cards viewed yet',
  '去宝可梦图鉴': 'Open Pokédex', '去实体卡牌图鉴': 'Open TCG Cards', '去 Pocket 图鉴': 'Open Pocket Cards',
  '基础资料': 'Basic Information', '基础数据': 'Basic Data', '全国编号': 'National Dex No.', '图鉴编号': 'Pokédex No.',
  '全国图鉴': 'National Pokédex', '地区图鉴': 'Regional Pokédex', '未收录地区编号': 'No regional Pokédex entry',
  '分类': 'Category', '身高': 'Height', '体重': 'Weight', '捕获率': 'Catch rate', '种族值': 'Base stats',
  '能力值与努力值': 'Stats & EV Yield', '击败获得：': 'EV yield:', '攻击': 'Attack', '防御': 'Defense',
  '特攻': 'Sp. Atk', '特防': 'Sp. Def', '速度': 'Speed', '蛋群': 'Egg groups', '性别比例': 'Gender ratio',
  '孵化周期': 'Hatch cycles', '基础亲密度': 'Base friendship', '成长速度': 'Growth rate', '孵蛋与培育': 'Breeding',
  '特性': 'Abilities', '隐藏': 'Hidden', '招式': 'Moves', '招式列表': 'Move List', '招式数': 'Moves',
  '威力': 'Power', '命中': 'Accuracy', '优先度': 'Priority', '目标': 'Target', '学习方式': 'Learn method',
  '学习时间': 'Learned at', '版本': 'Version', '效果概率': 'Effect chance', '招式机记录': 'Machine records',
  '异常状态': 'Status condition', '效果类别': 'Effect category', '连续次数': 'Hit count', '持续回合': 'Duration',
  '吸取/反伤': 'Drain / recoil', '回复': 'Healing', '击中要害等级': 'Critical-hit rate',
  '异常概率': 'Status chance', '畏缩概率': 'Flinch chance', '能力变化概率': 'Stat-change chance',
  '暂无招式数据': 'No move data', '暂无中文招式说明': 'No localized move description', '加载更多': 'Load more',
  '升级': 'Level up', '招式机': 'Machine', '遗传': 'Egg move', '教学': 'Tutor', '其他': 'Other',
  '进化链': 'Evolution Chain', '进化自': 'Evolves from', '可进化为': 'Evolves into', '当前形态': 'Current form',
  '进化条件待补充': 'Evolution condition unavailable', '起点': 'Base form', '形态': 'Form', '默认形态': 'Default form',
  '普通': 'Normal', '异色': 'Shiny', '3D 动态图': 'Animated 3D Sprite', '相关卡牌': 'Related Cards',
  '默认形态': 'Default form', '超极巨化': 'Gigantamax',
  '关联卡牌': 'Related cards', '关联宝可梦': 'Related Pokémon', '实体': 'Physical', 'Pocket卡牌': 'Pocket cards',
  '卡牌详情': 'Card Details', 'Pocket 卡牌详情': 'Pocket Card Details', '卡牌编号': 'Card number',
  '画师': 'Illustrator', '规则标记': 'Regulation mark', '发售日期': 'Release date', '镜面': 'Mirror',
  '中文描述': 'Card Description', '原卡牌描述': 'Original card text', '中文图鉴描述': 'Pokédex Entry',
  '中文通用描述': 'General Chinese entry', '暂无中文图鉴描述': 'No localized Pokédex entry',
  '费用': 'Cost', '总能量': 'Total energy', '能量': 'Energy', '撤退费用': 'Retreat cost',
  '对战资料': 'Battle Data', '规则': 'Rules', '获得方式': 'How to obtain', '附加信息': 'Additional Information',
  '暂无野外遭遇数据': 'No wild encounter data', '卡牌不存在': 'Card not found', '卡组不存在': 'Deck not found',
  '详情加载失败': 'Failed to load details', '卡牌详情加载中': 'Loading card details', '正在读取卡牌详情。': 'Loading card details.',
  '卡牌加载中': 'Loading cards', '卡牌图鉴加载中': 'Loading TCG cards', 'Pocket 图鉴加载中': 'Loading Pocket cards',
  '图鉴加载中': 'Loading Pokédex', '卡牌加载失败，点击重试': 'Failed to load cards. Click to retry.',
  '玩法加载失败': 'Failed to load tools', '图鉴数据': 'Pokédex data', 'PTCG 数据': 'PTCG data',
  'Pocket 数据': 'Pocket data', 'PTCG 自有缓存': 'PTCG server cache', '自有服务缓存': 'Server cache',
  '本地快照': 'Local snapshot', '本地备份': 'Local backup', '本地样例': 'Local sample',
  '我的图鉴数据': 'My Collection', '图鉴收藏与队伍': 'Pokédex favorites and teams',
  '收藏、拥有与愿望单': 'Favorites, owned cards and wishlist', '移动端卡牌收藏': 'Mobile card collection',
  '收藏、拥有状态与队伍保存在当前微信设备': 'Favorites, ownership and teams are stored in this browser',
  '猜谜记录': 'Quiz history', '已保存队伍成员': 'Saved team members', '等待添加宝可梦': 'Waiting for Pokémon',
  '更多': 'More', '查看全部轻玩法': 'View all tools', '版本号': 'Version', '用户意见反馈': 'Send Feedback',
  '通过微信反馈问题或建议': 'Send a problem report or suggestion', '语言': 'Language',
  '第一世代': 'Generation I', '第二世代': 'Generation II', '第三世代': 'Generation III',
  '第四世代': 'Generation IV', '第五世代': 'Generation V', '第六世代': 'Generation VI',
  '第七世代': 'Generation VII', '第八世代': 'Generation VIII', '第九世代': 'Generation IX',
  '世代未知': 'Unknown generation', '全国': 'National', '关都': 'Kanto', '城都': 'Johto', '丰缘': 'Hoenn',
  '神奥': 'Sinnoh', '合众': 'Unova', '卡洛斯': 'Kalos', '阿罗拉': 'Alola', '伽勒尔': 'Galar',
  '洗翠': 'Hisui', '帕底亚': 'Paldea', '一般': 'Normal', '火': 'Fire', '水': 'Water', '草': 'Grass',
  '电': 'Electric', '雷': 'Lightning', '冰': 'Ice', '格斗': 'Fighting', '斗': 'Fighting', '毒': 'Poison',
  '地面': 'Ground', '飞行': 'Flying', '超能力': 'Psychic', '超': 'Psychic', '虫': 'Bug', '岩石': 'Rock',
  '幽灵': 'Ghost', '龙': 'Dragon', '恶': 'Dark', '钢': 'Metal', '妖精': 'Fairy', '妖': 'Fairy',
  '无色': 'Colorless', '无': 'None', '未知': 'Unknown', '推荐': 'Recommended', '其他版本': 'Other versions',
  '最新': 'Newest', '最早': 'Oldest', '最新结果': 'Latest result', '指定数值': 'Specified value',
  '对应属性': 'Matching type', '可兑换或购买': 'Exchange or purchase', '任务奖励': 'Mission reward',
  '活动卡池': 'Event pool', '暂无公开记录': 'No public records', '商品': 'Items', '挑战卡池': 'Challenge pool'
}

const TW_PHRASES = {
  '宝可梦': '寶可夢', '图鉴': '圖鑑', '卡牌': '卡牌', '实体': '實體', '筛选': '篩選',
  '搜索': '搜尋', '加载': '載入', '数据': '資料', '队伍': '隊伍', '属性': '屬性',
  '热门': '熱門', '卡组': '牌組', '开包': '開包', '活动': '活動', '任务': '任務',
  '拥有': '擁有', '愿望单': '願望清單', '简体中文': '簡體中文', '用户': '使用者',
  '反馈': '回饋', '设置': '設定', '重置': '重設', '确定': '確定', '关闭': '關閉',
  '编号': '編號', '名称': '名稱', '稀有度': '稀有度', '训练家': '訓練家', '扩展包': '擴充包',
  '继续': '繼續', '全部': '全部', '暂无': '暫無', '没有': '沒有', '查看': '查看',
  '收藏': '收藏', '取消': '取消', '玩法': '玩法', '猜谜': '猜謎', '选择': '選擇',
  '提示': '提示', '确认': '確認', '提交': '提交', '删除': '刪除', '重命名': '重新命名',
  '弱点': '弱點', '抵抗': '抵抗', '免疫': '免疫', '复制': '複製', '详情': '詳情',
  '排行': '排行', '胜率': '勝率', '使用率': '使用率', '积分': '積分', '占比': '佔比',
  '普通包': '一般包', '特典包': '特典包', '当前': '目前', '即将': '即將', '进行中': '進行中',
  '结束': '結束', '长期': '長期', '单人战': '單人戰', '徽章战': '徽章戰', '商店': '商店',
  '今日': '今日', '最近': '最近', '浏览': '瀏覽', '基础': '基礎', '全国': '全國',
  '地区': '地區', '分类': '分類', '身高': '身高', '体重': '體重', '捕获率': '捕獲率',
  '种族值': '種族值', '能力值': '能力值', '攻击': '攻擊', '防御': '防禦',
  '特攻': '特攻', '特防': '特防', '速度': '速度', '孵化': '孵化', '亲密度': '親密度',
  '成长': '成長', '招式': '招式', '特性': '特性', '威力': '威力', '命中': '命中',
  '优先度': '優先度', '学习': '學習', '效果': '效果', '概率': '機率', '异常': '異常',
  '回复': '回復', '升级': '升級', '遗传': '遺傳', '教学': '教學', '进化': '進化',
  '形态': '型態', '异色': '異色', '相关': '相關', '关联': '關聯', '画师': '繪師',
  '规则': '規則', '发售': '發售', '费用': '費用', '能量': '能量', '撤退': '撤退',
  '获得方式': '獲得方式', '附加信息': '附加資訊', '本地': '本機', '快照': '快照',
  '备份': '備份', '第一世代': '第一世代', '第二世代': '第二世代', '第三世代': '第三世代',
  '第四世代': '第四世代', '第五世代': '第五世代', '第六世代': '第六世代',
  '第七世代': '第七世代', '第八世代': '第八世代', '第九世代': '第九世代',
  '关都': '關都', '城都': '城都', '丰缘': '豐緣', '神奥': '神奧', '合众': '合眾',
  '卡洛斯': '卡洛斯', '阿罗拉': '阿羅拉', '伽勒尔': '伽勒爾', '洗翠': '洗翠', '帕底亚': '帕底亞',
  '一般': '一般', '电': '電', '冰': '冰', '格斗': '格鬥', '毒': '毒', '地面': '地面',
  '飞行': '飛行', '超能力': '超能力', '虫': '蟲', '岩石': '岩石', '幽灵': '幽靈',
  '龙': '龍', '恶': '惡', '钢': '鋼', '妖精': '妖精', '无色': '無色', '未知': '未知'
}

const sortedTw = Object.entries(TW_PHRASES).sort((a, b) => b[0].length - a[0].length)
const TW_POST = {
  '搜索': '搜尋', '數據': '資料', '信息': '資訊', '卡組': '牌組', '用戶': '使用者',
  '反饋': '回饋', '默認': '預設', '視頻': '影片', '鏈接': '連結', '加載': '載入'
}
const sortedTwPost = Object.entries(TW_POST).sort((a, b) => b[0].length - a[0].length)
const EN_POST = {
  '非普通': 'Uncommon', '二阶进化': 'Stage 2', '一阶进化': 'Stage 1', '基础': 'Basic',
  '宝可梦': 'Pokémon', '训练家': 'Trainer', '异色稀有': 'Shiny Rare', '稀有': 'Rare',
  '系列：': 'Set: ', '属性：': 'Type: ', '稀有度：': 'Rarity: ', '编号：': 'Number: ',
  '世代：': 'Generation: ', '种族值总和：': 'Base stat total: ', '分类：': 'Category: ',
  '总能量': 'Total energy', '能量': 'energy', '物理': 'Physical', '特殊': 'Special',
  '属性防守': ' defensive matchups',
  '副牌表': 'deck lists',
  '变化': 'Status', '威力': 'Power', '击败获得：': 'EV yield: ', '队伍': 'Team',
  '草': 'Grass', '火': 'Fire', '水': 'Water', '电': 'Lightning', '雷': 'Lightning',
  '冰': 'Ice', '格斗': 'Fighting', '斗': 'Fighting', '毒': 'Poison', '地面': 'Ground',
  '飞行': 'Flying', '超能力': 'Psychic', '超': 'Psychic', '虫': 'Bug', '岩石': 'Rock',
  '幽灵': 'Ghost', '龙': 'Dragon', '恶': 'Darkness', '钢': 'Metal', '妖精': 'Fairy',
  '妖': 'Fairy', '无色': 'Colorless'
}
const sortedEnPost = Object.entries(EN_POST).sort((a, b) => b[0].length - a[0].length)
let traditionalConverter = null

export async function prepareLegacyLocale(locale) {
  if (locale !== 'zh-TW' || traditionalConverter) return
  const OpenCC = await import(/* webpackChunkName: "opencc-zh-tw" */ 'opencc-js/cn2t')
  traditionalConverter = OpenCC.Converter({ from: 'cn', to: 'tw' })
}

function dynamicEnglish(text) {
  let translated = text
    .replace(/第\s*(\d+)\s*世代/g, 'Generation $1')
    .replace(/(\d+)\s*只宝可梦/g, '$1 Pokémon')
    .replace(/(\d+)\s*张卡牌/g, '$1 cards')
    .replace(/已找到\s*(\d+)\s*张/g, '$1 found')
    .replace(/最多选择\s*(\d+)\s*个属性/g, 'Choose up to $1 types')
    .replace(/最多选择\s*(\d+)\s*只/g, 'Choose up to $1 Pokémon')
    .replace(/最多创建\s*(\d+)\s*个队伍/g, 'Create up to $1 teams')
    .replace(/(\d+)\s*个版本/g, '$1 versions')
    .replace(/(\d+)\s*个卡池/g, '$1 card pools')
    .replace(/(\d+)\s*项/g, '$1 items')
    .replace(/全国\s*#/g, 'National #')
    .replace(/种族值\s*(\d+)/g, 'BST $1')
    .replace(/(\d+)\s*招式/g, '$1 moves')
    .replace(/第\s*(\d+)\s*页/g, 'Page $1')
    .replace(/默认形态/g, 'Default form')
    .replace(/超极巨化/g, 'Gigantamax')
    .replace(/普通/g, 'Normal')
    .replace(/(\d+)\s*形态/g, '$1 forms')
    .replace(/实体卡牌/g, 'Physical TCG')
    .replace(/Pocket卡牌/g, 'Pocket cards')
    .replace(/队伍\s*(\d+)/g, 'Team $1')
    .replace(/(\d+)\s*分/g, '$1 points')
    .replace(/(\d+)\s*种\s*·\s*(\d+)\s*张/g, '$1 unique · $2 cards')
    .replace(/(\d+)\s*种/g, '$1 unique cards')
    .replace(/(\d+)\s*张/g, '$1 cards')
  if (/[㐀-鿿]/.test(translated) && translated.length <= 160) {
    translated = sortedEnPost.reduce((result, [from, to]) => result.replaceAll(from, to), translated)
  }
  return translated
}

export function translateLegacyText(value, locale) {
  const source = String(value || '')
  if (!source.trim() || locale === 'zh-CN') return source
  const leading = source.match(/^\s*/)[0]
  const trailing = source.match(/\s*$/)[0]
  const text = source.trim()
  if (locale === 'en') return leading + dynamicEnglish(EN[text] || text) + trailing
  let converted = traditionalConverter
    ? traditionalConverter(text)
    : sortedTw.reduce((result, [from, to]) => result.replaceAll(from, to), text)
  if (traditionalConverter) converted = sortedTwPost.reduce((result, [from, to]) => result.replaceAll(from, to), converted)
  return leading + converted + trailing
}
