import sys
import os
import json
import re
import time
import pyperclip
import requests
from bs4 import BeautifulSoup
from urllib.parse import unquote, urlparse, parse_qs
from requests.packages.urllib3.exceptions import InsecureRequestWarning
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry
from PyQt5.QtWidgets import QApplication, QWidget, QVBoxLayout, QLineEdit, QPushButton, QTextEdit, QMessageBox

# 忽略不安全请求警告
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

def get_steam_game_info(url):
    # 添加简体中文语言参数
    url += '?l=schinese'
    
    session = requests.Session()
    retry = Retry(
        total=5,
        read=5,
        connect=5,
        backoff_factor=0.3,
        status_forcelist=(500, 502, 504)
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount('http://', adapter)
    session.mount('https://', adapter)

    try:
        response = session.get(url, verify=False)  # 忽略SSL证书验证
        response.raise_for_status()  # 检查请求是否成功
    except requests.exceptions.RequestException as e:
        print(f"请求失败: {e}")
        return "请求失败，请检查网络连接或URL是否正确。"

    soup = BeautifulSoup(response.content, 'html.parser')

    def extract_text(selector, context=None, default='N/A'):
        element = (context or soup).select_one(selector)
        return element.text.strip() if element else default

    # 提取游戏名称
    game_name = extract_text('#appHubAppName')

    # 提取视频链接
    video_tag = soup.select_one('#highlight_player_area .highlight_movie')
    video_url = video_tag.get('data-mp4-hd-source', 'N/A') if video_tag else 'N/A'

    # 提取热门标签
    tags = [tag.text.strip() for tag in soup.select('.glance_tags.popular_tags a')]

    # 提取发行日期
    release_date = extract_text('.release_date .date')

    # 提取开发商和发行商
    developer_elements = soup.select('.dev_row .summary.column#developers_list a')
    developer = ', '.join([a.text for a in developer_elements]) if developer_elements else 'N/A'

    publisher_elements = soup.select('.dev_row .summary.column:not(#developers_list) a')
    publisher = ', '.join([a.text for a in publisher_elements]) if publisher_elements else 'N/A'

    # 提取封面图片链接
    cover_image_element = soup.select_one('link[rel="image_src"]')
    cover_image = cover_image_element['href'] if cover_image_element else 'N/A'

    # 提取截图链接并转换
    screenshots = []
    for tag in soup.select('.highlight_screenshot_link')[:5]:
        screenshot_url = tag['href']
        parsed_url = urlparse(screenshot_url)
        if 'u' in parse_qs(parsed_url.query):
            decoded_url = unquote(parse_qs(parsed_url.query)['u'][0])
            screenshots.append(decoded_url)
        else:
            screenshots.append(screenshot_url)

    # 提取系统需求
    sys_req_min = ''
    sys_req_rec = ''

    # 检查是否有多个系统的需求
    sys_req_sections = soup.select('.game_area_sys_req.sysreq_content')
    if sys_req_sections:
        for section in sys_req_sections:
            if 'data-os="win"' in str(section):
                # 检查是否有左右分栏
                left_col = section.select_one('.game_area_sys_req_leftCol')
                right_col = section.select_one('.game_area_sys_req_rightCol')
                
                if left_col and right_col:
                    sys_req_min = extract_text('.game_area_sys_req_leftCol', section)
                    sys_req_rec = extract_text('.game_area_sys_req_rightCol', section)
                else:
                    sys_req_min = extract_text('.game_area_sys_req_full', section)
                    sys_req_rec = extract_text('.game_area_sys_req_rightCol', section)
                break
    else:
        # 单一系统的情况
        sys_req_min = extract_text('.game_area_sys_req_leftCol')
        sys_req_rec = extract_text('.game_area_sys_req_rightCol')

    # 格式化系统需求
    def format_sys_req(sys_req):
        # 使用正则表达式去除HTML标签
        sys_req = re.sub(r'<.*?>', '', sys_req)
        # 使用正则表达式在每个配置项后添加换行符
        sys_req = re.sub(r'(?<=:)\s*', '\n', sys_req)
        # 去除多余的空行
        sys_req = re.sub(r'\n+', '\n', sys_req).strip()
        return sys_req + '\n'

    sys_req_min = format_sys_req(sys_req_min)
    sys_req_rec = format_sys_req(sys_req_rec)

    # 格式化输出
    output = """[img]https://gbtgame.me/upload/attach/202205/15828_K2XGEXPJBPE9K8K.png[/img]

[vc_separator]

[img]{cover_image}[/img]

[vc_separator]

[swagbox style="lavender"] [h5][b][color=#ffffff]（一）游戏简介[/color][/b][/h5] [/swagbox]

中文名称：[code]{game_name}[/code]

英文名称：[code]{game_name}[/code]

游戏类型：[code]{tags}[/code]

游戏大小：[code]GB[/code]

游戏制作：[code]{developer}[/code]

游戏发行：[code]{publisher}[/code]

游戏平台：[code]PC[/code]

发行时间：[code]{release_date}[/code]

[swagbox style="lavender"] [h5][b][color=#ffffff]（二）游戏截图[/color][/b][/h5] [/swagbox]

{screenshots}
[swagbox style="lavender"] [h5][b][color=#ffffff]（三）配置要求[/color][/b][/h5] [/swagbox]

[vc_column width="1/2"] [swagbox style="lavender"] [h5][b][color=#ffffff]最低配置[/color][/b][/h5] [/swagbox][/vc_column]

[blockquote]

{sys_req_min}
[/blockquote]

[vc_column width="1/2"] [swagbox style="lavender"] [h5][b][color=#ffffff]推荐配置[/color][/b][/h5] [/swagbox][/vc_column]

[blockquote]

{sys_req_rec}
[/blockquote]

[swagbox style="lavender"] [h5][b][color=#ffffff]（四）安装说明[/color][/b][/h5] [/swagbox]

（留空待编辑）

[swagbox style="lavender"] [h5][b][color=#ffffff]（五）游戏视频[/color][/b][/h5] [/swagbox]

<video controls="controls" width="650" height="350"><source src="{video_url}"></video>

[swagbox style="lavender"] [h5][b][color=#ffffff]（六）下载地址[/color][/b][/h5] [/swagbox]

留空待编辑

[blockquote]

本站现在将提供独家特权资源：

    ・凡本站资源使用迅雷APP下载，非会员迅雷账号，可享受普通白金会员一样的加速下载；
    ・使用迅雷下载需先保存华迅雷网盘账号中，本站所有资源均不占用迅雷网盘空间，与用户个人文件分别独立计算；
    ・以上特选仅限本站 【带有迅雷网盘】 发布的资源；
下载速度：可以稳定在5-10mb/s，具体由迅雷解释。

[/blockquote]

[blockquote]

GBT官方网盘推荐使用Free Download Manager下载器下载

https://www.freedownloadmanager.org/zh/

可获得最大带宽下载速度

[/blockquote]

FDM使用方法

<video controls="controls" width="640" height="360">
<source src="https://pan.gbtgame.me/d/%E6%B8%B8%E6%88%8F%E5%BF%85%E5%A4%87%E8%BD%AF%E4%BB%B6/FDM%E4%BD%BF%E7%94%A8%E6%9D%A1%E4%BB%B6%E4%B8%8E%E4%BD%BF%E7%94%A8%E6%96%B9%E6%B3%95.mp4?sign=IEoQSUyzPjbgTVszKrHRWtVdLlYDUt0fA7IkOaAFaOs=:0" type="video/mp4" data-mce-fragment="1"></video>
""".format(
        cover_image=cover_image,
        game_name=game_name,
        tags='[/code][code]'.join(tags),
        developer=developer,
        publisher=publisher,
        release_date=release_date,
        screenshots=''.join([f'[img]{screenshot}[/img]\n' for screenshot in screenshots]),
        sys_req_min=sys_req_min,
        sys_req_rec=sys_req_rec,
        video_url=video_url
    )

    return output

class App(QWidget):
    def __init__(self):
        super().__init__()
        self.title = 'Steam 游戏信息获取'
        self.initUI()

    def initUI(self):
        self.setWindowTitle(self.title)
        self.setGeometry(100, 100, 800, 600)

        layout = QVBoxLayout()

        self.url_input = QLineEdit(self)
        self.url_input.setPlaceholderText('请输入 Steam 游戏 URL')
        layout.addWidget(self.url_input)

        self.result_output = QTextEdit(self)
        layout.addWidget(self.result_output)

        self.copy_button = QPushButton('复制内容', self)
        self.copy_button.clicked.connect(self.copy_result)
        layout.addWidget(self.copy_button)

        self.run_button = QPushButton('获取信息', self)
        self.run_button.clicked.connect(self.run_script)
        layout.addWidget(self.run_button)

        self.setLayout(layout)

    def copy_result(self):
        pyperclip.copy(self.result_output.toPlainText())
        QMessageBox.information(self, "提示", "内容已复制到剪贴板")

    def run_script(self):
        url = self.url_input.text()
        if not url.startswith("https://store.steampowered.com/app/"):
            QMessageBox.critical(self, "错误", "请输入有效的 Steam 游戏 URL")
            return

        self.result_output.setText("正在获取信息，请稍候...")  # 提示用户正在加载

        try:
            output = get_steam_game_info(url)
            self.result_output.setText(output)
        except Exception as e:
            QMessageBox.critical(self, "错误", f"获取信息时出错: {e}")

if __name__ == '__main__':
    app = QApplication(sys.argv)
    ex = App()
    ex.show()
    sys.exit(app.exec_())
