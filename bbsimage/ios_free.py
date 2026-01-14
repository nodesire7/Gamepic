#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
iOS 限免应用 RSS 解析器
优化版 - 参考RSS格式，屏蔽广告内容，整理格式
"""

import feedparser
from bs4 import BeautifulSoup
from datetime import datetime
import re
import html
import sys


def is_ad_content(text, soup, entry_description, entry_title):
    """
    判断是否为广告/推广条目（增强版）
    参考RSS格式，精确识别广告内容
    """
    # 广告关键词列表
    ad_keywords = ["群组", "频道", "老鹰", "推特", "红薯", "Bluesky", "@o0apps", "推送频道"]
    
    # 检查是否包含 App Store 链接
    has_app_store_link = "apps.apple.com" in entry_description
    
    # 如果没有 App Store 链接，很可能是广告
    if not has_app_store_link:
        return True
    
    # 检查标题：如果是频道推广标题（如"🖼 App Store 限免应用 01/10/2026"），则为广告
    if entry_title:
        title_clean = entry_title.strip()
        # 如果标题是日期格式的汇总标题，则为广告
        if (("限免应用" in title_clean or "限免" in title_clean) and 
            ("🖼" in title_clean or "📱" in title_clean) and
            re.search(r'\d{2}/\d{2}/\d{4}', title_clean)):  # 包含日期格式
            return True
    
    # 提取纯文本内容（去除HTML标签、链接、blockquote）
    # 先移除blockquote（通常是App Store引用，包含有效信息）
    soup_clean = BeautifulSoup(entry_description, 'html.parser')
    for blockquote in soup_clean.find_all('blockquote'):
        blockquote.decompose()  # 移除blockquote，因为它是App Store信息，不算推广
    
    pure_text = soup_clean.get_text(separator=" ").strip()
    
    # 移除链接文本、标签、推广内容
    pure_text = re.sub(r'https?://[^\s]+', '', pure_text)
    pure_text = re.sub(r'@\w+', '', pure_text)
    pure_text = re.sub(r'#\w+', '', pure_text)
    pure_text = re.sub(r'(群组|频道|老鹰|推特|红薯|Bluesky)[：:].*', '', pure_text)
    pure_text = re.sub(r'\s+', ' ', pure_text).strip()
    
    # 统计广告关键词数量（在原始文本中）
    keyword_count = sum(1 for kw in ad_keywords if kw in entry_description)
    
    # 检查推广链接数量
    promotion_patterns = [
        r'群组[：:].*?https?://',
        r'频道[：:].*?https?://',
        r'老鹰[：:].*?https?://',
        r'推特[：:].*?https?://',
        r'红薯[：:].*?https?://',
        r'Bluesky[：:].*?https?://'
    ]
    promotion_links_count = sum(1 for pattern in promotion_patterns if re.search(pattern, entry_description, re.IGNORECASE))
    
    # 逻辑判断：
    # 1. 如果有3个或以上推广链接，视为广告
    if promotion_links_count >= 3:
        return True
    
    # 2. 如果关键字过多，视为广告
    if keyword_count >= 3:
        return True
    
    # 3. 如果纯文本长度小于15，可能是纯推广
    if len(pure_text) < 15:
        return True
    
    # 4. 检查是否只有推广内容，没有实际应用描述
    # 移除所有HTML标签和链接后，如果剩余文本很少，可能是广告
    if len(pure_text) < 20 and promotion_links_count >= 1:
        return True
    
    return False


def clean_description(soup):
    """
    清理描述内容，移除广告内容
    参考RSS格式，精确清理推广内容
    1. 移除群组/频道/推特等推广链接
    2. 保留App Store相关信息（blockquote中的内容通常是有用的）
    3. 提取有效的应用描述
    """
    # 创建副本，避免修改原始soup
    soup_clean = BeautifulSoup(str(soup), 'html.parser')
    
    # 移除广告相关的链接和文本
    ad_keywords = ["群组", "频道", "老鹰", "推特", "红薯", "Bluesky", "@o0apps", "推送频道"]
    
    for tag in soup_clean.find_all(['a', 'p', 'span']):
        tag_text = tag.get_text().strip()
        # 如果标签文本包含广告关键词，移除该标签
        if any(keyword in tag_text for keyword in ad_keywords):
            # 检查是否是推广链接（包含http）
            if 'http' in tag_text.lower() or any(keyword in tag_text for keyword in ["群组", "频道", "@"]):
                tag.decompose()
    
    # 移除整行包含推广内容的文本
    for text_node in soup_clean.find_all(string=True):
        parent = text_node.parent
        if parent and parent.name not in ['script', 'style']:
            text_content = text_node.strip()
            # 如果文本包含推广关键词和链接，移除父元素
            if any(keyword in text_content for keyword in ad_keywords) and 'http' in text_content.lower():
                if parent.name in ['p', 'span', 'div']:
                    parent.decompose()
    
    # 提取有效文本（blockquote中的内容保留，因为它包含App Store信息）
    clean_text = soup_clean.get_text(separator="\n").strip()
    
    # 移除空行和多余的空白
    lines = [line.strip() for line in clean_text.split('\n') if line.strip()]
    
    # 过滤掉只包含推广内容的行
    filtered_lines = []
    for line in lines:
        # 如果行只包含链接或推广内容，跳过
        if (re.match(r'^https?://', line) or 
            any(keyword in line for keyword in ad_keywords) or
            line.startswith('#') and len(line) < 20):
            continue
        filtered_lines.append(line)
    
    return filtered_lines


def extract_app_info(entry_description, soup, entry_title=""):
    """
    从RSS条目中提取应用信息
    参考RSS格式，精确提取信息
    返回: 包含应用信息的字典
    """
    # 1. 提取标题
    # 优先使用entry_title（RSS格式中的title字段），更准确
    if entry_title:
        title = entry_title.strip()
    else:
        # 如果没有title，从description第一行提取
        lines = [line.strip() for line in entry_description.split('\n') if line.strip()]
        title = lines[0] if lines else "Unknown App"
    
    # 移除标题中的表情符号标记（如 🖼 📱）
    title = re.sub(r'[🖼📱📲]', '', title).strip()
    
    # 移除标题中的日期格式（如 "01/10/2026"）
    title = re.sub(r'\d{2}/\d{2}/\d{4}', '', title).strip()
    
    # 清理标题（移除可能的广告标记）
    title = re.sub(r'\s*\[.*?\]\s*', '', title)  # 移除方括号内容
    title = re.sub(r'\s*\(.*?\)\s*$', '', title)  # 移除尾部括号
    title = title.strip()
    
    # 如果标题还是包含"限免应用"等关键词，可能不是具体应用，返回None
    if "限免应用" in title or "限免" in title and len(title) < 30:
        return None
    
    # 2. 提取App Store链接（使用更精确的正则）
    app_link_match = re.search(r'https://apps\.apple\.com/[^\s\)"\']+', entry_description)
    if not app_link_match:
        return None
    app_link = app_link_match.group(0).rstrip(')').rstrip('"').rstrip("'")
    
    # 3. 提取标签类型
    if "#本体限免" in entry_description:
        tag = "# 本体限免"
    elif "#内购限免" in entry_description:
        tag = "# 内购限免"
    else:
        tag = "# 限时免费"
    
    # 4. 提取图片URL（优先从blockquote中的图片，因为质量更好）
    img_url = ""
    blockquote = soup.find('blockquote')
    if blockquote:
        img_tag = blockquote.find('img')
        if img_tag and img_tag.get('src'):
            img_url = img_tag['src']
    
    # 如果没有找到，尝试从其他地方找（但排除可能的小图标）
    if not img_url:
        all_imgs = soup.find_all('img')
        for img_tag in all_imgs:
            if img_tag.get('src'):
                src = img_tag['src']
                # 优先选择较大的图片（通常应用截图更大）
                if 'cdn' in src or 'telesco' in src:
                    img_url = src
                    break
                elif not img_url:  # 如果没有找到CDN图片，使用第一个
                    img_url = src
    
    # 5. 提取描述（优先从主文本提取中文描述，更准确）
    desc = ""
    
    # 方法1：优先从主文本中提取中文描述（通常是第二行，如"逻辑填格益智游戏"）
    # 根据RSS格式，主文本的第二行通常是应用的中文描述
    clean_lines = clean_description(soup)
    
    # 先尝试提取第二行（通常是应用描述）
    if len(clean_lines) >= 2:
        second_line = clean_lines[1].strip()
        # 如果第二行是有效的描述（不是链接、标签、推广内容）
        if (len(second_line) >= 10 and len(second_line) <= 100 and
            not second_line.startswith('http') and 
            not second_line.startswith('#') and 
            not second_line.startswith('Download') and
            "App Store" not in second_line and
            "apps.apple.com" not in second_line and
            not any(x in second_line for x in ["群组", "频道", "@", "推送频道", "还可以兑换"])):
            desc = second_line
    
    # 如果第二行不是有效描述，遍历所有行查找
    if not desc:
        for i, line in enumerate(clean_lines):
            # 跳过标题行（第一行通常是应用名）
            if i == 0 or line == title or line == entry_title:
                continue
            
            # 过滤掉链接、标签、推广内容、App Store信息
            if (len(line) >= 10 and len(line) <= 100 and
                not line.startswith('http') and 
                not line.startswith('#') and 
                not line.startswith('Download') and
                "App Store" not in line and
                "apps.apple.com" not in line and
                not any(x in line for x in ["群组", "频道", "@", "推送频道", "群组:", "频道:", "老鹰:", "推特:", "红薯:", "Bluesky:", "还可以兑换"])):
                desc = line
                break
    
    # 方法2：如果主文本没有有效描述，从blockquote中的App Store描述提取（备用）
    if not desc and blockquote:
        # blockquote中通常有App Store的完整描述，格式类似：
        # "Download Nonoverse - Nonogram Puzzles by Bartlomiej Niemtur on the App Store. See screenshots, ratings and reviews, user tips, and more games like Nonoverse -…"
        # 我们需要提取应用的实际描述，而不是"Download ... on the App Store"
        desc_p = blockquote.find('p')
        if desc_p:
            desc_text = desc_p.get_text().strip()
            # 移除"Download ... on the App Store"部分
            desc_text = re.sub(r'Download\s+[^.]*?\s+on\s+the\s+App\s+Store\.?\s*', '', desc_text, flags=re.IGNORECASE)
            desc_text = desc_text.strip()
            
            # 如果还有内容，提取第一部分（通常是应用描述）
            if desc_text:
                # 移除"See screenshots, ratings..."等常见后缀
                desc_text = re.sub(r'See\s+screenshots.*', '', desc_text, flags=re.IGNORECASE).strip()
                desc_text = re.sub(r'See\s+more.*', '', desc_text, flags=re.IGNORECASE).strip()
                
                # 提取第一个有意义的句子
                sentences = desc_text.split('.')
                for sentence in sentences:
                    sentence = sentence.strip()
                    if len(sentence) > 20 and len(sentence) < 150:  # 合理的描述长度
                        desc = sentence
                        break
                
                # 如果没有找到合适的句子，使用前100个字符
                if not desc and len(desc_text) > 30:
                    desc = desc_text[:100].strip()
                    if desc.endswith('…') or desc.endswith('...'):
                        desc = desc[:-1].strip()
        
        # 如果从p标签没提取到，尝试从整个blockquote文本提取
        if not desc:
            blockquote_text = blockquote.get_text(separator=" ").strip()
            # 移除"App Store"、"Download"等关键词
            blockquote_text = re.sub(r'Download\s+[^.]*?\s+on\s+the\s+App\s+Store\.?\s*', '', blockquote_text, flags=re.IGNORECASE)
            blockquote_text = re.sub(r'App\s+Store', '', blockquote_text, flags=re.IGNORECASE)
            blockquote_text = re.sub(r'\s+', ' ', blockquote_text).strip()
            
            if len(blockquote_text) > 30:
                # 提取第一个句子
                sentences = blockquote_text.split('.')
                for sentence in sentences:
                    sentence = sentence.strip()
                    if len(sentence) > 20 and len(sentence) < 150:
                        desc = sentence
                        break
    
    # 清理描述：移除可能的推广内容和多余空白
    if desc:
        desc = re.sub(r'https?://[^\s]+', '', desc)
        desc = re.sub(r'@\w+', '', desc)
        desc = re.sub(r'#\w+', '', desc)
        desc = re.sub(r'(群组|频道|老鹰|推特|红薯|Bluesky)[：:].*', '', desc)
        desc = re.sub(r'Download\s+.*?App\s+Store', '', desc, flags=re.IGNORECASE)
        desc = re.sub(r'See\s+(screenshots|more).*', '', desc, flags=re.IGNORECASE)
        desc = re.sub(r'\s+', ' ', desc).strip()
        
        # 如果描述太短，可能是无效内容
        if len(desc) < 10:
            desc = ""
    
    # 6. 提取兑换码（如果有，格式：/redeem/?ctx=offercodes&id=...&code=REDOLIFETIMEFREEDECEMBER）
    redeem_code = None
    redeem_match = re.search(r'/redeem/.*?code=([A-Z0-9-]+)', entry_description, re.IGNORECASE)
    if redeem_match:
        redeem_code = redeem_match.group(1)
        # 清理兑换码（移除可能的引号或特殊字符）
        redeem_code = redeem_code.rstrip('"').rstrip("'").rstrip(')').strip()
    
    # 验证必要信息
    if not title or len(title) < 2:
        return None
    
    return {
        'title': title,
        'description': desc if desc else "",
        'image_url': img_url,
        'app_link': app_link,
        'tag': tag,
        'redeem_code': redeem_code
    }


def format_date(date_str):
    """格式化日期"""
    try:
        dt = datetime.strptime(date_str, "%a, %d %b %Y %H:%M:%S %Z")
        return dt.strftime("%Y年%m月%d日")
    except:
        try:
            dt = datetime.strptime(date_str, "%a, %d %b %Y %H:%M:%S %z")
            return dt.strftime("%Y年%m月%d日")
        except:
            return date_str


def generate_html_output(apps_data, current_date_str, return_html=False):
    """
    生成HTML输出（优化格式，参考RSS结构）
    
    Args:
        apps_data: 应用数据列表
        current_date_str: 当前日期字符串
        return_html: 如果为True，返回HTML字符串；如果为False，打印HTML
    
    Returns:
        如果return_html=True，返回HTML字符串；否则返回None
    """
    # CSS样式（深色模式优化）
    style_block = """<style>
    :root {
        --gbt-accent: #ff9d00;
        --gbt-accent-hover: #ffb136;
        --gbt-bg: #1c2129;
        --gbt-card: #1c2129;
        --gbt-text: #e2e8f0;
        --gbt-sub: #8492a6;
        --gbt-border: #2d323d;
    }
    
    .gbt-resource-wrapper {
        font-family: -apple-system, "PingFang SC", BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        padding: 15px;
        max-width: 1000px;
        margin: 0 auto;
    }
    
    .gbt-header {
        text-align: center;
        margin: 25px 0 30px;
        color: #000 !important;
        font-size: 24px;
        font-weight: 900;
        line-height: 1.3;
    }
    
    /* 深色模式下标题颜色 */
    .dark-theme .gbt-header,
    body.dark-theme .gbt-header,
    html.dark .gbt-header,
    [data-theme="dark"] .gbt-header {
        color: #e2e8f0 !important;
    }
    
    .gbt-resource-card {
        max-width: 880px;
        margin: 0 auto 18px;
        padding: 18px 22px;
        border-radius: 16px;
        background: var(--main-bg-color);
        border: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        gap: 20px;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }
    
    .dark-theme .gbt-resource-card,
    body.dark-theme .gbt-resource-card,
    html.dark .gbt-resource-card {
        background: var(--gbt-card);
        border-color: var(--gbt-border);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }
    
    .gbt-resource-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
    }
    
    .dark-theme .gbt-resource-card:hover,
    body.dark-theme .gbt-resource-card:hover {
        box-shadow: 0 12px 35px rgba(0, 0, 0, 0.4);
    }
    
    .gbt-res-preview {
        flex-shrink: 0;
        width: 100px;
        height: 100px;
        border-radius: 18px;
        overflow: hidden;
        border: 2px solid var(--border-color);
        background: #f5f5f5;
    }
    
    .dark-theme .gbt-res-preview,
    body.dark-theme .gbt-res-preview {
        border-color: var(--gbt-border);
        background: #2d323d;
    }
    
    .gbt-res-preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }
    
    .gbt-res-info {
        flex-grow: 1;
        min-width: 0;
    }
    
    .gbt-res-tag {
        display: inline-flex;
        background: rgba(255, 157, 0, 0.12);
        color: var(--gbt-accent);
        padding: 3px 10px;
        font-size: 10px;
        font-weight: 700;
        border-radius: 5px;
        margin-bottom: 8px;
        letter-spacing: 0.3px;
    }
    
    .gbt-res-title {
        font-size: 18px;
        font-weight: 800;
        color: var(--focus-color);
        margin: 0 0 6px 0;
        line-height: 1.35;
    }
    
    .dark-theme .gbt-res-title,
    body.dark-theme .gbt-res-title {
        color: #fff;
    }
    
    .gbt-res-desc {
        font-size: 13px;
        color: var(--muted-2-color);
        line-height: 1.5;
        margin: 0 0 10px 0;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
    
    .dark-theme .gbt-res-desc,
    body.dark-theme .gbt-res-desc {
        color: var(--gbt-sub);
    }
    
    .gbt-res-footer {
        font-size: 11px;
        color: var(--muted-3-color);
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
    }
    
    .dark-theme .gbt-res-footer,
    body.dark-theme .gbt-res-footer {
        color: var(--gbt-sub);
    }
    
    .gbt-redeem-code {
        display: inline-block;
        background: rgba(72, 187, 120, 0.15);
        color: #48bb78;
        padding: 2px 8px;
        border-radius: 5px;
        font-size: 10px;
        font-weight: 600;
        font-family: monospace;
        letter-spacing: 0.3px;
    }
    
    .gbt-publish-date {
        color: var(--muted-3-color);
        font-size: 11px;
    }
    
    .dark-theme .gbt-publish-date {
        color: var(--gbt-sub);
    }
    
    .gbt-download-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--gbt-accent);
        color: #fff;
        padding: 10px 22px;
        border-radius: 10px;
        font-weight: 700;
        font-size: 13px;
        text-decoration: none;
        transition: all 0.3s ease;
        white-space: nowrap;
    }
    
    .dark-theme .gbt-download-btn,
    body.dark-theme .gbt-download-btn {
        color: #000;
    }
    
    .gbt-download-btn:hover {
        background: var(--gbt-accent-hover);
        transform: translateY(-1px);
        box-shadow: 0 3px 10px rgba(255, 157, 0, 0.3);
    }
    
    @media (max-width: 650px) {
        .gbt-resource-wrapper {
            padding: 12px;
        }
        
        .gbt-header {
            margin: 20px 0 25px;
            font-size: 20px;
        }
        
        .gbt-resource-card {
            flex-direction: column;
            text-align: center;
            padding: 16px;
            gap: 16px;
        }
        
        .gbt-res-preview {
            width: 90px;
            height: 90px;
        }
        
        .gbt-res-action {
            width: 100%;
        }
        
        .gbt-download-btn {
            width: 100%;
        }
    }
    </style>"""
    
    html_lines = []
    html_lines.append(style_block)
    html_lines.append(f'<div class="gbt-resource-wrapper">')
    html_lines.append(f'<div class="gbt-header"> App Store 限免应用 – {current_date_str}</div>')
    
    for app in apps_data:
        # 转义HTML特殊字符
        title = html.escape(app['title'])
        desc = html.escape(app['description']) if app['description'] else "暂无描述"
        img_url = html.escape(app['image_url']) if app['image_url'] else "https://via.placeholder.com/110x110?text=App"
        app_link = html.escape(app['app_link'])
        tag = html.escape(app['tag'])
        
        # 生成HTML卡片
        html_lines.append(f'    <div class="gbt-resource-card zib-widget">')
        html_lines.append(f'        <div class="gbt-res-preview"><img src="{img_url}" loading="lazy" alt="{title}" onerror="this.src=\'https://via.placeholder.com/110x110?text=App\'"></div>')
        html_lines.append(f'        <div class="gbt-res-info">')
        html_lines.append(f'            <div class="gbt-res-tag">{tag}</div>')
        html_lines.append(f'            <h3 class="gbt-res-title">{title}</h3>')
        html_lines.append(f'            <p class="gbt-res-desc">{desc}</p>')
        html_lines.append(f'            <div class="gbt-res-footer">')
        if app.get('publish_date'):
            html_lines.append(f'                <span class="gbt-publish-date">发布日期：{app["publish_date"]}</span>')
        if app.get('redeem_code'):
            html_lines.append(f'                <span class="gbt-redeem-code">兑换码: {app["redeem_code"]}</span>')
        html_lines.append(f'            </div>')
        html_lines.append(f'        </div>')
        html_lines.append(f'        <div class="gbt-res-action"><a href="{app_link}" target="_blank" rel="noopener" class="gbt-download-btn">立即获取</a></div>')
        html_lines.append(f'    </div>')
    
    html_lines.append('</div>')
    
    # 添加WordPress块注释（按照参考格式 ios格式.html）
    # 格式：<!-- wp:html --> ... <!-- /wp:html --> 然后 <!-- wp:paragraph --><p></p><!-- /wp:paragraph -->
    wp_html = '<!-- wp:html -->\n' + '\n'.join(html_lines) + '\n<!-- /wp:html -->\n\n<!-- wp:paragraph -->\n<p></p>\n<!-- /wp:paragraph -->'
    
    if return_html:
        return wp_html
    else:
        print(wp_html)
        return None


def get_app_limit_free(return_data=False):
    """
    主函数：获取并处理限免应用信息
    
    Args:
        return_data: 如果为True，返回(html_content, title, apps_data)；如果为False，打印HTML
    
    Returns:
        如果return_data=True，返回(html_content, title, apps_data)元组：
            - html_content: 生成的HTML内容
            - title: 文章标题（例如："App Store 限免应用 – 2026年01月10日"）
            - apps_data: 应用数据列表
        如果return_data=False，返回None
    """
    rss_url = "https://rsshub.rssforever.com/telegram/channel/ooapps"
    
    try:
        feed = feedparser.parse(rss_url)
    except Exception as e:
        error_msg = f"错误：无法获取RSS源 - {str(e)}"
        if return_data:
            return (f"<p style='color: red; padding: 20px;'>{error_msg}</p>", None, [])
        else:
            print(f"<p style='color: red; padding: 20px;'>{error_msg}</p>", file=sys.stderr)
            sys.exit(1)
    
    if not feed.entries:
        error_msg = "<p style='padding: 20px;'>暂无应用信息</p>"
        if return_data:
            return (error_msg, None, [])
        else:
            print(error_msg)
            return None
    
    current_date_str = datetime.now().strftime("%Y年%m月%d日")
    apps_data = []
    
    for entry in feed.entries:
        # 1. 基本过滤：必须有 App Store 链接
        if "apps.apple.com" not in entry.description:
            continue
        
        # 2. 获取entry的title（RSS格式中的title字段更准确）
        entry_title = entry.get('title', '').strip() if hasattr(entry, 'title') else ""
        
        # 3. 解析HTML内容
        soup = BeautifulSoup(entry.description, 'html.parser')
        raw_text = soup.get_text(separator="\n")
        
        # 4. 广告内容过滤：排除纯频道推广条目（使用entry_title判断更准确）
        if is_ad_content(raw_text, soup, entry.description, entry_title):
            continue
        
        # 5. 提取应用信息（传入entry_title以便更准确提取）
        app_info = extract_app_info(entry.description, soup, entry_title)
        if not app_info:
            continue
        
        # 6. 验证必要信息（必须有标题和链接）
        if not app_info['title'] or not app_info['app_link']:
            continue
        
        # 7. 如果描述为空或太短，跳过（可能是广告）
        if not app_info['description'] or len(app_info['description']) < 10:
            continue
        
        # 8. 再次验证：标题不能只是"限免应用"等通用词
        if app_info['title'] in ["限免应用", "App Store 限免应用", "限时免费"] or len(app_info['title']) < 3:
            continue
        
        # 9. 添加发布日期
        try:
            if hasattr(entry, 'published') and entry.published:
                app_info['publish_date'] = format_date(entry.published)
            elif hasattr(entry, 'published_parsed') and entry.published_parsed:
                app_info['publish_date'] = datetime(*entry.published_parsed[:6]).strftime("%Y年%m月%d日")
            else:
                app_info['publish_date'] = current_date_str
        except Exception as e:
            app_info['publish_date'] = current_date_str
        
        apps_data.append(app_info)
    
    # 10. 生成标题（使用长破折号 –）
    article_title = f" App Store 限免应用 – {current_date_str}"
    
    # 11. 生成HTML输出
    if apps_data:
        if return_data:
            html_content = generate_html_output(apps_data, current_date_str, return_html=True)
            return (html_content, article_title, apps_data)
        else:
            generate_html_output(apps_data, current_date_str, return_html=False)
            return None
    else:
        error_msg = "<p style='padding: 20px;'>今日暂无限免应用</p>"
        if return_data:
            return (error_msg, article_title, [])
        else:
            print(error_msg)
            return None


if __name__ == "__main__":
    get_app_limit_free()
