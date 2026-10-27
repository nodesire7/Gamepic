/**
 * Clash Party JavaScript 覆写：直连测速 / 全组直连 / 自动与手选分离
 *
 * 用法：在「覆写」中新建或编辑 JavaScript，完整替换旧脚本并应用到订阅。
 * 客户端全局「测速地址」请留空，或填 directTestUrl；不要继续使用 Google 测直连。
 * 面板测的是目标网址的连通延迟，不是下载带宽。
 *
 * 所有可见选择组都有「全局直连」；该组本身仅含 DIRECT，避免自引用。
 * 自动选优、故障转移、负载均衡和地区组：外层手选，内层保留自动算法。
 * 隐藏自动组不加入直连；无可用节点时拒绝连接，避免空地区隐式直连。
 */

const SETTINGS = {
    // 直连和面板手选组使用微软联网探测；返回 200。
    // 如果你的网络无法访问此地址，可换成你已确认能直连的检测网址及状态码。
    directTestUrl: "http://www.msftconnecttest.com/connecttest.txt",
    directExpectedStatus: 200,
    // 自动节点池使用海外 HTTPS 204，继续检查代理的海外访问能力。
    proxyTestUrl: "https://www.gstatic.com/generate_204",
    proxyExpectedStatus: 204,
    interval: 240,
    tolerance: 80,
    timeout: 5000,
    domesticDns: ["https://dns.alidns.com/dns-query", "https://doh.pub/dns-query"],
    bootstrapDns: ["223.5.5.5", "119.29.29.29"],
    // 只过滤常见订阅提示条目，不改节点密码、协议、TLS 或服务器地址。
    infoPattern: "剩余流量|套餐到期|流量重置|订阅到期|到期时间|官方网站|订阅网址|流量余额|Traffic Remaining|Remaining Traffic|Expire Date",
};

// 保留原脚本实际生效的自定义规则。
// deviantart.com 原先重复指定了两个出口；按首条优先保留「全局直连」。
const customRules = [
    "DOMAIN-SUFFIX,hmian.sharepoint.com,手动选择",
    "DOMAIN-SUFFIX,www.themoviedb.org,全局直连",
    "DOMAIN-SUFFIX,hanime1.me,地区选择",
    "DOMAIN-SUFFIX,online-fix.me,地区选择",
    "DOMAIN-SUFFIX,drive.online-fix.me,地区选择",
    "DOMAIN-SUFFIX,my.telegram.org,手动选择",
    "DOMAIN-SUFFIX,gbtgame.me,节点选择",
    "DOMAIN-SUFFIX,deviantart.com,全局直连",
    "DOMAIN-SUFFIX,nexusmods.com,地区选择",
    "DOMAIN-SUFFIX,hosters.online-fix.me,地区选择",
    "DOMAIN-SUFFIX,web.localsend.org,地区选择",
    "DOMAIN-SUFFIX,maj-soul.com,地区选择",
    "DOMAIN-SUFFIX,xiaoheihe.cn,手动选择",
    "DOMAIN-KEYWORD,vikingfile,手动选择",
    "DOMAIN-SUFFIX,gamecircum.com,全局直连"
];

// 保留原来的 25 个规则集及下载地址。
const ruleProviders = {
    "ipdirect": {"type": "http","format": "mrs","interval": 86400,"behavior": "ipcidr","url": "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geoip/cn.mrs","path": "./ruleset/cncidr.mrs"},
    "ipprivate": {"type": "http","format": "mrs","interval": 86400,"behavior": "ipcidr","url": "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geoip/private.mrs","path": "./ruleset/lancidr.mrs"},
    "direct": {"type": "http","format": "mrs","interval": 86400,"behavior": "domain","url": "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/cn.mrs","path": "./ruleset/direct.mrs"},
    "private": {"type": "http","format": "mrs","interval": 86400,"behavior": "domain","url": "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/private.mrs","path": "./ruleset/private.mrs"},
    "google": {"type": "http","format": "mrs","interval": 86400,"behavior": "domain","url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/google.mrs","path": "./ruleset/google.mrs"},
    "microsoft": {"type": "http","format": "mrs","interval": 86400,"behavior": "domain","url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/microsoft.mrs","path": "./ruleset/microsoft.mrs"},
    "apple": {"type": "http","format": "mrs","interval": 86400,"behavior": "domain","url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/apple.mrs","path": "./ruleset/apple.mrs"},
    "bing": {"type": "http","format": "mrs","interval": 86400,"behavior": "domain","url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/bing.mrs","path": "./ruleset/bing.mrs"},
    "github": {"type": "http","format": "mrs","interval": 86400,"behavior": "domain","url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/github.mrs","path": "./ruleset/github.mrs"},
    "onedrive": {"type": "http","format": "mrs","interval": 86400,"behavior": "domain","url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/onedrive.mrs","path": "./ruleset/onedrive.mrs"},
    "youtube": {"type": "http","format": "mrs","interval": 86400,"behavior": "domain","url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/youtube.mrs","path": "./ruleset/youtube.mrs"},
    "pornhub": {"type": "http","format": "mrs","interval": 86400,"behavior": "domain","url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/pornhub.mrs","path": "./ruleset/pornhub.mrs"},
    "netflix_ip": {"type": "http","format": "mrs","interval": 86400,"behavior": "ipcidr","url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geoip/netflix.mrs","path": "./ruleset/netflix-ip.mrs"},
    "netflix_site": {"type": "http","format": "mrs","interval": 86400,"behavior": "domain","url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/netflix.mrs","path": "./ruleset/netflix-site.mrs"},
    "adobe": {"type": "http","format": "mrs","interval": 86400,"behavior": "domain","url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/adobe.mrs","path": "./ruleset/adobe.mrs"},
    "ai": {"type": "http","format": "mrs","interval": 86400,"behavior": "domain","url": "https://github.com/DustinWin/ruleset_geodata/releases/download/mihomo-ruleset/ai.mrs","path": "./ruleset/ai.mrs"},
    "bilibili": {"type": "http","format": "mrs","interval": 86400,"behavior": "domain","url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/bilibili.mrs","path": "./ruleset/bilibili.mrs"},
    "tiktok": {"type": "http","format": "mrs","interval": 86400,"behavior": "domain","url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/tiktok.mrs","path": "./ruleset/tiktok.mrs"},
    "spotify": {"type": "http","format": "mrs","interval": 86400,"behavior": "domain","url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/spotify.mrs","path": "./ruleset/spotify.mrs"},
    "speedtest": {"type": "http","format": "mrs","interval": 86400,"behavior": "domain","url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/speedtest.mrs","path": "./ruleset/speedtest.mrs"},
    "games": {"type": "http","format": "mrs","interval": 86400,"behavior": "domain","url": "https://github.com/DustinWin/ruleset_geodata/releases/download/mihomo-ruleset/games-cn.mrs","path": "./ruleset/games.mrs"},
    "telegramcidr": {"type": "http","format": "mrs","interval": 86400,"behavior": "ipcidr","url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geoip/telegram.mrs","path": "./ruleset/telegramcidr.mrs"},
    "proxy": {"type": "http","format": "mrs","interval": 86400,"behavior": "domain","url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo-lite/geosite/proxy.mrs","path": "./rulesets/loyalsoldier/proxy.mrs"},
    "gfw": {"type": "http","format": "mrs","interval": 86400,"behavior": "domain","url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/gfw.mrs","path": "./ruleset/gfw.mrs"},
    "tld-not-cn": {"type": "http","format": "mrs","interval": 86400,"behavior": "domain","url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/tld-!cn.mrs","path": "./ruleset/tld-not-cn.mrs"}
};

// 代码缩写带字母边界，并统一忽略大小写；不再把 RUSSIA 的 US 当作美国。
const regionConfig = [
    {"name": "🇺🇸 美国 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/us.svg","pattern": "(?:美国|美國|🇺🇸|United[ _-]*States|America|(?:^|[^A-Za-z])(?:US|USA)(?:$|[^A-Za-z]))"},
    {"name": "🇯🇵 日本 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/jp.svg","pattern": "(?:日本|🇯🇵|Japan|(?:^|[^A-Za-z])(?:JP|JPN)(?:$|[^A-Za-z]))"},
    {"name": "🇰🇷 韩国 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/kr.svg","pattern": "(?:韩国|韓國|南韩|南韓|🇰🇷|Korea|(?:^|[^A-Za-z])(?:KR|KOR)(?:$|[^A-Za-z]))"},
    {"name": "🇸🇬 新加坡 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/sg.svg","pattern": "(?:新加坡|狮城|獅城|🇸🇬|Singapore|(?:^|[^A-Za-z])(?:SG|SGP)(?:$|[^A-Za-z]))"},
    {"name": "🇭🇰 香港 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/hk.svg","pattern": "(?:香港|🇭🇰|Hong[ _-]*Kong|(?:^|[^A-Za-z])(?:HK|HKG)(?:$|[^A-Za-z]))"},
    {"name": "🇹🇼 台湾 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/tw.svg","pattern": "(?:台湾|台灣|臺灣|🇹🇼|Tai[ _-]*Wan|(?:^|[^A-Za-z])(?:TW|TWN)(?:$|[^A-Za-z]))"},
    {"name": "🇬🇧 英国 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/gb.svg","pattern": "(?:英国|英國|🇬🇧|United[ _-]*Kingdom|Great[ _-]*Britain|England|(?:^|[^A-Za-z])(?:UK|GB|GBR)(?:$|[^A-Za-z]))"},
    {"name": "🇫🇷 法国 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/fr.svg","pattern": "(?:法国|法國|🇫🇷|France|(?:^|[^A-Za-z])(?:FR|FRA)(?:$|[^A-Za-z]))"},
    {"name": "🇩🇪 德国 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/de.svg","pattern": "(?:德国|德國|🇩🇪|Germany|(?:^|[^A-Za-z])(?:DE|DEU|GER)(?:$|[^A-Za-z]))"},
    {"name": "🇵🇱 波兰 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/pl.svg","pattern": "(?:波兰|波蘭|🇵🇱|Poland|(?:^|[^A-Za-z])(?:PL|POL)(?:$|[^A-Za-z]))"},
    {"name": "🇳🇱 荷兰 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/nl.svg","pattern": "(?:荷兰|荷蘭|🇳🇱|Netherlands|(?:^|[^A-Za-z])(?:NL|NLD)(?:$|[^A-Za-z]))"},
    {"name": "🇮🇪 爱尔兰 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/ie.svg","pattern": "(?:爱尔兰|愛爾蘭|🇮🇪|Ireland|(?:^|[^A-Za-z])(?:IE|IRL)(?:$|[^A-Za-z]))"},
    {"name": "🇸🇪 瑞典 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/se.svg","pattern": "(?:瑞典|🇸🇪|Sweden|(?:^|[^A-Za-z])(?:SE|SWE)(?:$|[^A-Za-z]))"},
    {"name": "🇷🇺 俄罗斯 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/ru.svg","pattern": "(?:俄罗斯|俄羅斯|🇷🇺|Russia|(?:^|[^A-Za-z])(?:RU|RUS)(?:$|[^A-Za-z]))"},
    {"name": "🇮🇹 意大利 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/it.svg","pattern": "(?:意大利|義大利|🇮🇹|Italy|(?:^|[^A-Za-z])(?:IT|ITA)(?:$|[^A-Za-z]))"},
    {"name": "🇪🇸 西班牙 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/es.svg","pattern": "(?:西班牙|🇪🇸|Spain|(?:^|[^A-Za-z])(?:ES|ESP)(?:$|[^A-Za-z]))"},
    {"name": "🇵🇹 葡萄牙 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/pt.svg","pattern": "(?:葡萄牙|🇵🇹|Portugal|(?:^|[^A-Za-z])(?:PT|PRT)(?:$|[^A-Za-z]))"},
    {"name": "🇹🇷 土耳其 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/tr.svg","pattern": "(?:土耳其|🇹🇷|Turkey|Turkiye|Türkiye|(?:^|[^A-Za-z])(?:TR|TUR)(?:$|[^A-Za-z]))"},
    {"name": "🇦🇷 阿根廷 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/ar.svg","pattern": "(?:阿根廷|🇦🇷|Argentina|(?:^|[^A-Za-z])(?:AR|ARG)(?:$|[^A-Za-z]))"},
    {"name": "🇨🇦 加拿大 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/ca.svg","pattern": "(?:加拿大|🇨🇦|Canada|(?:^|[^A-Za-z])(?:CA|CAN)(?:$|[^A-Za-z]))"},
    {"name": "🇦🇺 澳大利亚 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/au.svg","pattern": "(?:澳大利亚|澳大利亞|澳洲|🇦🇺|Australia|(?:^|[^A-Za-z])(?:AU|AUS)(?:$|[^A-Za-z]))"},
    {"name": "🇮🇷 伊朗 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/ir.svg","pattern": "(?:伊朗|🇮🇷|Iran|(?:^|[^A-Za-z])(?:IR|IRN)(?:$|[^A-Za-z]))"},
    {"name": "🇮🇩 印度尼西 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/id.svg","pattern": "(?:印度尼西亚|印度尼西亞|印尼|🇮🇩|Indonesia|(?:^|[^A-Za-z])(?:ID|IDN)(?:$|[^A-Za-z]))"},
    {"name": "🇲🇾 马来西亚 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/my.svg","pattern": "(?:马来西亚|馬來西亞|马来|馬來|🇲🇾|Malaysia|(?:^|[^A-Za-z])(?:MY|MYS)(?:$|[^A-Za-z]))"},
    {"name": "🇵🇭 菲律宾 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/ph.svg","pattern": "(?:菲律宾|菲律賓|🇵🇭|Philippines|(?:^|[^A-Za-z])(?:PH|PHL)(?:$|[^A-Za-z]))"},
    {"name": "🇮🇳 印度 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/in.svg","pattern": "(?:印度|🇮🇳|India|(?:^|[^A-Za-z])(?:IN|IND)(?:$|[^A-Za-z]))"},
    {"name": "🇻🇳 越南 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/vn.svg","pattern": "(?:越南|🇻🇳|Vietnam|Viet[ _-]*Nam|(?:^|[^A-Za-z])(?:VN|VNM)(?:$|[^A-Za-z]))"},
    {"name": "🇹🇭 泰国 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/th.svg","pattern": "(?:泰国|泰國|🇹🇭|Thailand|(?:^|[^A-Za-z])(?:TH|THA)(?:$|[^A-Za-z]))"},
    {"name": "🇨🇳 中国 📶","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/cn.svg","pattern": "(?:中国|中國|大陆|大陸|🇨🇳|China|(?:^|[^A-Za-z])(?:CN|CHN)(?:$|[^A-Za-z]))"},
    {"name": "🌐 其他 📶","icon": "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Global.png"}
];

const groupTemplates = [
    {"name": "节点选择","type": "select","proxies": ["延迟选优","手动选择","故障转移","负载均衡(散列)","负载均衡(轮询)"],"icon": "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Airport.png"},
    {"name": "手动选择","type": "select","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/adjust.svg"},
    {"name": "漏网之鱼","type": "select","proxies": ["全局直连","节点选择","手动选择","延迟选优","故障转移"],"icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/fish.svg"},
    {"name": "Bing","type": "select","proxies": ["全局直连","节点选择","手动选择","延迟选优","故障转移"],"icon": "https://www.bing.com/favicon.ico"},
    {"name": "Github","type": "select","proxies": ["节点选择","手动选择","全局直连","延迟选优","故障转移"],"icon": "https://www.clashverge.dev/assets/icons/github.svg"},
    {"name": "谷歌服务","type": "select","proxies": ["节点选择","手动选择","全局直连","延迟选优","故障转移"],"icon": "https://www.clashverge.dev/assets/icons/google.svg"},
    {"name": "苹果服务","type": "select","proxies": ["全局直连","节点选择","手动选择","延迟选优","故障转移"],"icon": "https://www.clashverge.dev/assets/icons/apple.svg"},
    {"name": "微软服务","type": "select","proxies": ["全局直连","节点选择","手动选择","延迟选优","故障转移"],"icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/microsoft.svg"},
    {"name": "Onedrive","type": "select","proxies": ["全局直连","节点选择","手动选择","延迟选优","故障转移"],"icon": "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/OneDrive.png"},
    {"name": "AI","type": "select","proxies": ["全局直连","节点选择","手动选择","延迟选优","故障转移"],"icon": "https://www.clashverge.dev/assets/icons/chatgpt.svg"},
    {"name": "Bilibili","type": "select","proxies": ["全局直连"],"icon": "https://fastly.jsdelivr.net/gh/Orz-3/mini@master/Color/Bili.png"},
    {"name": "YouTube","type": "select","proxies": ["节点选择","手动选择","延迟选优","故障转移"],"icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/youtube.svg"},
    {"name": "Netflix","type": "select","proxies": ["节点选择","手动选择","延迟选优","故障转移"],"icon": "https://www.clashverge.dev/assets/icons/netflix.svg"},
    {"name": "TikTok","type": "select","proxies": ["节点选择","手动选择","延迟选优","故障转移"],"icon": "https://fastly.jsdelivr.net/gh/shindgewongxj/WHATSINStash@master/icon/tiktok.png"},
    {"name": "Pornhub","type": "select","proxies": ["节点选择","手动选择","延迟选优","故障转移"],"icon": "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Pornhub_1.png"},
    {"name": "Spotify","type": "select","proxies": ["全局直连","节点选择","手动选择","延迟选优","故障转移"],"icon": "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Spotify.png"},
    {"name": "Adobe","type": "select","proxies": ["全局直连","REJECT","节点选择"],"icon": "https://www.adobe.com/favicon.ico"},
    {"name": "游戏服务","type": "select","proxies": ["全局直连","节点选择","手动选择","延迟选优","故障转移"],"icon": "https://www.clashverge.dev/assets/icons/steam.svg"},
    {"name": "电报消息","type": "select","proxies": ["节点选择","手动选择","延迟选优","故障转移"],"icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/telegram.svg"},
    {"name": "网速测试","type": "select","proxies": ["全局直连"],"icon": "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Speedtest.png"},
    {"name": "负载均衡(轮询)","type": "load-balance","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/balance.svg","strategy": "round-robin"},
    {"name": "负载均衡(散列)","type": "load-balance","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/merry_go.svg","strategy": "consistent-hashing"},
    {"name": "故障转移","type": "fallback","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/ambulance.svg"},
    {"name": "全局直连","type": "select","proxies": ["DIRECT"],"icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/link.svg"},
    {"name": "延迟选优","type": "url-test","icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/speed.svg"}
];
const originalFakeIpFilter = [
    "+.lan",
    "+.local",
    "+.msftconnecttest.com",
    "+.msftncsi.com",
    "localhost.ptlogin2.qq.com",
    "localhost.sec.qq.com",
    "localhost.work.weixin.qq.com",
    "*.localdomain",
    "*.example",
    "*.invalid",
    "*.localhost",
    "*.test",
    "*.local",
    "*.home.arpa"
];
const defaultSniffer = {
    "enable": true,
    "force-dns-mapping": true,
    "parse-pure-ip": true,
    "override-destination": true,
    "sniff": {
        "TLS": {
            "ports": [
                443,
                8443
            ]
        },
        "HTTP": {
            "ports": [
                80,
                "8080-8880"
            ],
            "override-destination": true
        },
        "QUIC": {
            "ports": [
                443,
                8443
            ]
        }
    }
};

const DIRECT_GROUP = "全局直连";
const AUTO_SUFFIX = " · 自动";
const BUILTINS = new Set(["DIRECT", "REJECT", "REJECT-DROP", "COMPATIBLE", "PASS", "GLOBAL"]);
const NON_PROXY_TYPES = new Set(["direct", "reject", "reject-drop", "rejectdrop", "compatible", "pass", "dns"]);

function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function unique(items) {
    return Array.from(new Set(items.filter(function (item) {
        return typeof item === "string" && item.length > 0;
    })));
}

function escapeRegex(value) {
    return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function selectGroup(name, proxies, icon) {
    return {
        name: name,
        type: "select",
        proxies: unique(proxies),
        url: SETTINGS.directTestUrl,
        "expected-status": SETTINGS.directExpectedStatus,
        interval: 0,
        timeout: SETTINGS.timeout,
        lazy: true,
        hidden: false,
        "disable-udp": false,
        icon: icon,
    };
}

function engineGroup(name, type, names, providers, icon, filter, excludeFilter, strategy) {
    const group = {
        name: name + AUTO_SUFFIX,
        type: type,
        // Provider-only / 空地区放一个不可用的 REJECT 占位，兼容旧核心。
        // 它不是直连后备；有正常节点时仍由原自动算法选择。
        proxies: names.length > 0 ? names.slice() : ["REJECT"],
        url: SETTINGS.proxyTestUrl,
        "expected-status": SETTINGS.proxyExpectedStatus,
        interval: SETTINGS.interval,
        timeout: SETTINGS.timeout,
        lazy: true,
        hidden: true,
        "disable-udp": false,
        "exclude-type": "Direct|Compatible|Pass",
        "empty-fallback": "REJECT",
        icon: icon,
    };
    if (providers.length > 0) group.use = providers.slice();
    // 全局池显式匹配全部节点，避免 provider 的共享额外健康检查只测到已命名地区。
    group.filter = filter ? "(?i)" + filter : ".*";
    if (excludeFilter) group["exclude-filter"] = "(?i)" + excludeFilter;
    if (type === "url-test") group.tolerance = SETTINGS.tolerance;
    if (type === "load-balance") group.strategy = strategy;
    return group;
}

function buildDns(previous) {
    const old = isObject(previous) ? clone(previous) : {};
    const oldPolicy = isObject(old["nameserver-policy"]) ? old["nameserver-policy"] : {};
    return {
        ...old,
        enable: true,
        ipv6: typeof old.ipv6 === "boolean" ? old.ipv6 : true,
        "prefer-h3": false,
        "use-hosts": true,
        "use-system-hosts": true,
        listen: old.listen || "0.0.0.0:1053",
        "cache-algorithm": "arc",
        "enhanced-mode": "fake-ip",
        "fake-ip-range": old["fake-ip-range"] || "198.18.0.1/16",
        "fake-ip-filter-mode": "blacklist",
        "fake-ip-filter": unique(originalFakeIpFilter.concat(
            Array.isArray(old["fake-ip-filter"]) && (!old["fake-ip-filter-mode"] || old["fake-ip-filter-mode"] === "blacklist")
                ? old["fake-ip-filter"] : []
        )),
        "default-nameserver": SETTINGS.bootstrapDns.slice(),
        nameserver: SETTINGS.domesticDns.slice(),
        // 节点服务器与直连目标各自使用可直连 DNS，避免初始化依赖代理。
        "proxy-server-nameserver": SETTINGS.domesticDns.slice(),
        "direct-nameserver": SETTINGS.domesticDns.slice(),
        "direct-nameserver-follow-policy": false,
        "respect-rules": false,
        // 保留订阅中显式的专用域名 DNS；不会把“国外 DNS”误当网站分流。
        "nameserver-policy": oldPolicy,
    };
}

function buildRules() {
    return customRules.concat([
        "RULE-SET,private,全局直连",
        "RULE-SET,ipprivate,全局直连,no-resolve",
        // 子服务在母集合之前，避免 YouTube 被 Google、Onedrive 被 Microsoft 抢先命中。
        "RULE-SET,youtube,YouTube",
        "RULE-SET,netflix_site,Netflix",
        "RULE-SET,tiktok,TikTok",
        "RULE-SET,ai,AI",
        "RULE-SET,bing,Bing",
        "RULE-SET,github,Github",
        "RULE-SET,onedrive,Onedrive",
        "RULE-SET,adobe,Adobe",
        "RULE-SET,pornhub,Pornhub",
        "RULE-SET,spotify,Spotify",
        "RULE-SET,games,游戏服务",
        "RULE-SET,speedtest,网速测试",
        "RULE-SET,bilibili,Bilibili",
        "RULE-SET,google,谷歌服务",
        "RULE-SET,apple,苹果服务",
        "RULE-SET,microsoft,微软服务",
        "RULE-SET,telegramcidr,电报消息,no-resolve",
        "RULE-SET,netflix_ip,Netflix,no-resolve",
        "RULE-SET,direct,全局直连",
        "RULE-SET,proxy,节点选择",
        "RULE-SET,gfw,节点选择",
        "RULE-SET,tld-not-cn,节点选择",
        "RULE-SET,ipdirect,全局直连,no-resolve",
        "MATCH,漏网之鱼",
    ]);
}

function checkGraph(config) {
    const groups = config["proxy-groups"];
    const byName = new Map();
    const nodeByName = new Map(config.proxies.map(function (node) { return [node.name, node]; }));
    for (const group of groups) {
        if (byName.has(group.name) || nodeByName.has(group.name)) {
            throw new Error("节点或策略组重名，请先给订阅节点改名：" + group.name);
        }
        byName.set(group.name, group);
    }
    function exists(name) {
        return BUILTINS.has(name) || byName.has(name) || nodeByName.has(name);
    }
    for (const group of groups) {
        for (const name of group.proxies || []) {
            if (!exists(name)) throw new Error("策略组「" + group.name + "」引用不存在的出口：" + name);
        }
        for (const name of group.use || []) {
            if (!Object.prototype.hasOwnProperty.call(config["proxy-providers"], name)) {
                throw new Error("策略组引用不存在的 provider：" + name);
            }
        }
    }
    // 检查原订阅节点的链式依赖，避免覆写后留下不存在的 dialer-proxy。
    for (const node of config.proxies) {
        if (node["dialer-proxy"] && !exists(node["dialer-proxy"])) {
            throw new Error("节点「" + node.name + "」的 dialer-proxy 引用了被替换的订阅组：" + node["dialer-proxy"]);
        }
    }
    const visiting = new Set();
    const visited = new Set();
    function visit(name) {
        if (visiting.has(name)) throw new Error("检测到策略循环引用：" + name);
        if (visited.has(name)) return;
        visiting.add(name);
        const group = byName.get(name);
        const node = nodeByName.get(name);
        if (group) (group.proxies || []).forEach(visit);
        else if (node && node["dialer-proxy"]) visit(node["dialer-proxy"]);
        visiting.delete(name);
        visited.add(name);
    }
    groups.forEach(function (group) { visit(group.name); });
    for (const rule of config.rules) {
        const parts = rule.split(",");
        const target = parts[0] === "MATCH" ? parts[1] : parts[2];
        if (!exists(target)) throw new Error("规则引用不存在的策略：" + target);
        if (parts[0] === "RULE-SET" && !config["rule-providers"][parts[1]]) {
            throw new Error("规则引用不存在的规则集：" + parts[1]);
        }
    }
    for (const name of Object.keys(config["proxy-providers"])) {
        const provider = config["proxy-providers"][name];
        for (const ref of [provider.proxy, provider.override && provider.override["dialer-proxy"]]) {
            if (ref && !exists(ref)) throw new Error("provider「" + name + "」引用不存在的出口：" + ref);
        }
    }
}

function main(input) {
    if (!isObject(input)) throw new Error("覆写需要一个有效的 Clash 配置对象。");
    if (input.proxies != null && !Array.isArray(input.proxies)) {
        throw new Error("proxies 应为数组；请检查订阅格式。");
    }
    if (input["proxy-providers"] != null && !isObject(input["proxy-providers"])) {
        throw new Error("proxy-providers 应为对象；请检查订阅格式。");
    }
    // 每次调用创建新对象，不污染上一份配置，也不会重复追加地区组。
    const config = clone(input);
    config.proxies = Array.isArray(config.proxies) ? config.proxies : [];
    config["proxy-providers"] = isObject(config["proxy-providers"]) ? config["proxy-providers"] : {};
    const providers = Object.keys(config["proxy-providers"]);
    const seenNodes = new Set();
    for (const node of config.proxies) {
        if (!isObject(node) || typeof node.name !== "string" || !node.name || typeof node.type !== "string") {
            throw new Error("发现缺少 name/type 的节点，请检查订阅。");
        }
        if (seenNodes.has(node.name)) throw new Error("订阅节点重名：" + node.name);
        seenNodes.add(node.name);
    }
    for (const name of providers) {
        const provider = config["proxy-providers"][name];
        if (!isObject(provider)) throw new Error("provider「" + name + "」不是有效对象。");
        // 保留 provider 已有的健康检查；自定义 URL 不强加 204 状态要求。
        const previousHealth = isObject(provider["health-check"]) ? provider["health-check"] : {};
        const health = {
            enable: true,
            url: SETTINGS.proxyTestUrl,
            interval: SETTINGS.interval,
            timeout: SETTINGS.timeout,
            lazy: true,
            ...previousHealth,
        };
        if (!health.url) health.url = SETTINGS.proxyTestUrl;
        if (!Object.prototype.hasOwnProperty.call(previousHealth, "expected-status") && health.url === SETTINGS.proxyTestUrl) {
            health["expected-status"] = SETTINGS.proxyExpectedStatus;
        }
        provider["health-check"] = health;
    }
    const infoRegex = SETTINGS.infoPattern ? new RegExp(SETTINGS.infoPattern, "i") : null;
    const nodes = config.proxies.filter(function (node) {
        return !NON_PROXY_TYPES.has(node.type.toLowerCase()) && !(infoRegex && infoRegex.test(node.name));
    });
    if (nodes.length === 0 && providers.length === 0) {
        throw new Error("配置中没有可用代理节点或 proxy-providers；请先选择有效订阅。");
    }
    const names = nodes.map(function (node) { return node.name; });
    const automatic = groupTemplates.filter(function (group) { return group.type !== "select"; });
    const generatedNames = groupTemplates.map(function (group) { return group.name; })
        .concat(["地区选择"], regionConfig.map(function (region) { return region.name; }));
    const reservedNames = generatedNames.concat(
        automatic.map(function (group) { return group.name + AUTO_SUFFIX; }),
        regionConfig.map(function (region) { return region.name + AUTO_SUFFIX; })
    );
    for (const node of config.proxies) {
        if (reservedNames.includes(node.name)) {
            throw new Error("订阅节点与覆写策略组重名，请重命名该节点：" + node.name);
        }
    }
    const reservedPattern = "^(?:" + reservedNames.map(escapeRegex).join("|") + ")$";
    const commonExclude = [SETTINGS.infoPattern, reservedPattern].filter(Boolean).join("|");
    const hiddenGroups = [];
    const regionGroups = [];
    const regionNames = [];
    let previousPatterns = [];
    for (const region of regionConfig) {
        const matcher = region.pattern ? new RegExp(region.pattern, "i") : null;
        const previous = previousPatterns.length ? new RegExp(previousPatterns.join("|"), "i") : null;
        const selected = names.filter(function (name) {
            return (!matcher || matcher.test(name)) && (!previous || !previous.test(name));
        });
        // provider 内容在内核运行时才可见，所以 provider 模式保留地区入口。
        if (selected.length > 0 || providers.length > 0) {
            const exclude = [commonExclude].concat(previousPatterns).filter(Boolean).join("|");
            hiddenGroups.push(engineGroup(region.name, "url-test", selected, providers,
                region.icon, region.pattern || "", exclude));
            regionGroups.push(selectGroup(region.name, [region.name + AUTO_SUFFIX, DIRECT_GROUP], region.icon));
            regionNames.push(region.name);
        }
        if (region.pattern) previousPatterns.push(region.pattern);
    }
    const groups = [];
    for (const template of groupTemplates) {
        if (template.name === DIRECT_GROUP) {
            const direct = selectGroup(DIRECT_GROUP, ["DIRECT"], template.icon);
            direct.interval = SETTINGS.interval;
            direct.lazy = false;
            groups.push(direct);
        } else if (template.type !== "select") {
            hiddenGroups.push(engineGroup(template.name, template.type, names, providers,
                template.icon, "", commonExclude, template.strategy));
            groups.push(selectGroup(template.name, [template.name + AUTO_SUFFIX, DIRECT_GROUP], template.icon));
        } else if (template.name === "手动选择") {
            const choices = names.length > 0 ? names.concat([DIRECT_GROUP]) : ["延迟选优", DIRECT_GROUP];
            const manual = selectGroup(template.name, choices, template.icon);
            if (providers.length > 0) manual.use = providers.slice();
            manual["exclude-type"] = "Direct|Compatible|Pass";
            if (SETTINGS.infoPattern) manual["exclude-filter"] = "(?i)" + SETTINGS.infoPattern;
            groups.push(manual);
        } else if (template.name === "网速测试") {
            const speed = selectGroup(template.name, [DIRECT_GROUP].concat(names), template.icon);
            if (providers.length > 0) speed.use = providers.slice();
            speed["exclude-type"] = "Direct|Compatible|Pass";
            if (SETTINGS.infoPattern) speed["exclude-filter"] = "(?i)" + SETTINGS.infoPattern;
            groups.push(speed);
        } else {
            const choices = (template.proxies || []).slice();
            if (template.name === "节点选择") choices.splice(2, 0, "地区选择");
            else choices.push(...regionNames);
            choices.push(DIRECT_GROUP);
            groups.push(selectGroup(template.name, choices, template.icon));
        }
    }
    groups.splice(1, 0, selectGroup("地区选择", regionNames.concat([DIRECT_GROUP]),
        "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/World_Map.png"));
    config["proxy-groups"] = groups.concat(regionGroups, hiddenGroups);
    config.profile = {
        ...(isObject(config.profile) ? config.profile : {}),
        "store-selected": true,
        "store-fake-ip": true,
    };
    config["unified-delay"] = true;
    config["tcp-concurrent"] = true;
    config["geodata-loader"] = "standard";
    config["geosite-matcher"] = "mph";
    config["global-client-fingerprint"] = "chrome";
    config["global-ua"] = "chrome";
    config.dns = buildDns(config.dns);
    config.sniffer = { ...clone(defaultSniffer), ...(isObject(config.sniffer) ? config.sniffer : {}) };
    config["rule-providers"] = {
        ...(isObject(config["rule-providers"]) ? config["rule-providers"] : {}),
        ...clone(ruleProviders),
    };
    config.rules = buildRules();
    delete config.foreign_nameservers;
    delete config.domestic_nameservers;
    checkGraph(config);
    return config;
}
