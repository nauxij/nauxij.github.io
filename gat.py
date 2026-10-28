import requests
import base64
import re
from datetime import datetime
from collections import defaultdict
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ==========Gitee上传配置==========
GITEE_TOKEN = "c3c228c418ce006cb138f3dbc920099b"
GITEE_USER = "x21y"
GITEE_REPO = "yx"
GITEE_FILE_NAME = "qdyd1.txt"
GITEE_BRANCH = "main"

# ==========【配置区，新增URL只往这里列表里加即可】============
url_list = [
    "http://38.75.136.137:88/api/tvlist.php"
]
# ==========================================================

def normalize_raw_name(name: str):
    """台名标准化：清除空格、制表符，繁体转简体，全部小写（只用于匹配，不改变最终输出台名）"""
    s = re.sub(r"[\t 　]", "", name.strip())
    #繁体汉字替换清单
    trans = {
        "緯":"纬", "來":"来", "臺":"台", "劇":"剧", "電影":"电影",
        "東":"东", "華":"华", "藝":"艺", "龍":"龙", "灣":"湾"
    }
    for old_char,new_char in trans.items():
        s = s.replace(old_char,new_char)
    return s.lower()

# 1.精确别名【优先执行】：名字相近极易串台的频道全部放这里
alias_map = {
    "cctv-5":"CCTV5",
    "CCTV-03咪咕":"CCTV3",
    "CCTV-3HD":"CCTV3",
    "CCTV-3 综艺":"CCTV3",
    "CCTV-央视台球":"央视台球",
    "CCTV11戏曲":"CCTV11",
    "CCTV12社会与法":"CCTV12",
    "CCTV8电视剧":"CCTV8",
    "CCTV6电影":"CCTV6",
    "CCTV17农业农村":"CCTV17",
    "CCTV15音乐":"CCTV15",
    "上视东方影视":"东方影视",
    "凤凰(香港)":"凤凰香港",
    "凤凰卫视香港台":"凤凰香港",

    # 纬来系列
    "纬来电影台":"纬来电影",
    "緯來電影":"纬来电影",

    "纬来戏剧台":"纬来戏剧台",
    "纬来体育台":"纬来体育台",
    "纬来精彩": "纬来戏剧",
    "Now爆谷台": "爆谷",
    "纬来电影台": "纬来电影",
    "东森电影ETTVMovie": "东森电影",
    "三立戏剧台": "三立戏剧",
    "ELta戏剧": "ELTA综合",
    "爱尔达戏剧台": "ELTA综合",
    "EYETV戏剧": "EYE戏剧",
    "龙祥时代": "龙祥时代",
    "三立综合SanliMetro": "三立综合",
    "东森综合ETTVMetro": "东森综合",
    "东森戏剧ETTVDrama": "东森戏剧",

    # 靖天、靖洋高危组，必须精确匹配，禁止模糊
    "靖天电影台":"靖天电影",
    "靖天戏剧台":"靖天戏剧",
    "靖天映画":"靖天映画",
    "靖洋戏剧台":"靖洋戏剧",
    "靖洋戏剧":"靖洋戏剧",

    # 民视 / 公视 / 采昌 高危组
    "民视影剧台":"民视影剧台",
    "公视戏剧":"公视戏剧",
    "采昌影剧台":"采昌影剧台",

    # CHC系列
    "CHC动作电影":"CHC动作电影",
    "CHC影迷电影":"CHC影迷电影",
    "CHC家庭影院":"CHC家庭影院",

    # 天映系列
    "天映频道":"天映频道",
    "天映经典":"天映经典",
    "BRTV文艺":"北京文艺",
    "风云剧场高清":"风云剧场",
    "古装大剧频道":"古装剧场",
    "中國電影":"中国电影",
    "IPTV相声小品":"相声小品",
    "TVB黃金華劇":"黄金华剧台",
    "五星体育HD":"五星体育",
    "东方影视HD":"东方影视",
    "CCTV-11HD":"CCTV11",
    "CCTV-12HD":"CCTV12",
    "CCTV-15HD":"CCTV15",
    "CCTV-17HD":"CCTV17",
    "CCTV-1HD":"CCTV1",
    "CCTV-5+HD":"CCTV5+",
    "CCTV-5HD":"CCTV5",
    "CCTV-6HD":"CCTV6",
    "CCTV-8HD":"CCTV8",
    "CCTV-兵器科技":"兵器科技",
    "CCTV-第一剧场":"第一剧场",
    "CCTV-风云剧场":"风云剧场",
    "CCTV-风云音乐":"风云音乐",
    "CCTV-央视台球":"央视台球",
    "湖南卫视4K":"湖南卫视",
    "浙江卫视4K":"浙江卫视",
    "东方卫视4K":"东方卫视",
    "江苏卫视4K":"江苏卫视",
    "北京卫视4K":"北京卫视",
    "深圳卫视4K":"深圳卫视",
    "广东卫视4K":"广东卫视",
    "山东卫视4K":"山东卫视",
    "四川峨眉电影":"峨眉电影",
    "四川卫视4K":"四川卫视",
    "都市剧场HD":"都市剧场",


    "安徽卫视HD":"安徽卫视",
    "天津卫视HD":"天津卫视",
    "辽宁卫视HD":"辽宁卫视",
    "东南卫视HD":"东南卫视",

    "湖北卫视HD":"湖北卫视",
    "贵州卫视HD":"贵州卫视",

    "重庆卫视HD":"重庆卫视",
    "海南卫视HD":"海南卫视",
    "四川卫视HD":"四川卫视",
    "山西卫视HD":"山西卫视",
    "河南卫视HD":"河南卫视",
    
    "江西卫视HD":"江西卫视",
    "广西卫视HD":"广西卫视",
    "云南卫视HD":"云南卫视",
    "陕西卫视HD":"陕西卫视",

    "宁夏卫视":"宁夏卫视",
    "山东卫视HD":"山东卫视",
    "欢笑剧场HD":"欢笑剧场",
    "甘肃卫视HD":"甘肃卫视",
    "天映电影Pdtv":"天映频道",
    "天映电影欣赏":"天映频道",
    "天映经典欣赏":"天映经典",
    "天映频道欣赏":"天映频道",
    "天映频道频晴":"天映频道",
    "黑龙江影视":"黑龙江影视",
    "都市剧场HD":"都市剧场",
    "TVB翡翠劇集":"翡翠剧集",
    "龍華電影":"龙华电影",
    "兵团卫视":"兵团卫视",
    "ELta综合FYtv":"ELTA综合",
    "EYE-戏剧FYtv":"EYE戏剧",
    "NOW星影台":"星影",
    "Now星影国赏":"星影",
    "Now爆谷Pdtv":"爆谷",
    "Now爆谷国赏":"爆谷",
    "亚洲武侠":"无线功夫",
    "无线功夫Pdtv":"无线功夫",
    "无线功夫国赏":"无线功夫",
    "TVB亚洲武侠":"无线功夫",
    "无线星河Pdtv":"星河",
    "无线星河双语":"星河",
    "无线星河国赏":"星河",

    "龍華偶像":"龙华偶像",
    "龙华偶像4Gtv":"龙华偶像",
    "龙华偶像Pdtv":"龙华偶像",
    "龙华偶像台":"龙华偶像",
    "龙华戏剧4Gtv":"龙华戏剧",
    "龙华戏剧Pdtv":"龙华戏剧",
    "龙华电影4Gtv":"龙华电影",
    "龙华电影Pdtv":"龙华电影",
    "龙华电影台":"龙华电影",
    "龙华经典4Gtv":"龙华经典",
    "东森电影FYtv":"东森电影",
    "东森电影欣赏":"东森电影",

    "TVB星河频道":"星河"
}

# 2.模糊关键词匹配：精确匹配没命中才跑这里；长关键词写上方，防止误匹配
fuzzy_rules = [
    ("CCTV5+", "CCTV5+"),
    ("cctv5+", "CCTV5+"),
    ("CCTV5", "CCTV5"),
    ("cctv5", "CCTV5"),
    ("中央5", "CCTV5"),

    ("CCTV3", "CCTV3"),
    ("cctv3", "CCTV3"),

    ("CCTV6", "CCTV6"),
    ("cctv6", "CCTV6"),

    ("凤凰香港", "凤凰香港"),
    ("凤凰卫视香港", "凤凰香港"),

    ("纬来电影", "纬来电影"),
    ("TVB星河", "星河"),
]

def fix_url(link):
    """保留自定义协议：video://、rtmp://，仅处理//无协议链接"""
    lnk = link.strip()
    if lnk.startswith(("video://", "rtmp://")):
        return lnk
    if lnk.startswith("//"):
        lnk = "http:" + lnk
    return lnk

def get_std_name(raw_name):
    """优先精确别名，失败后执行关键词模糊匹配"""
    n = raw_name.strip()
    if n in alias_map:
        return alias_map[n]
    for keyword, std_name in fuzzy_rules:
        if keyword in n:
            return std_name
    return n

# 带重试+浏览器UA，解决超时、403防盗拦截
def get_req_session():
    sess = requests.Session()
    retry = Retry(total=3, backoff_factor=0.7, status_forcelist=[429,500,502,503,504])
    sess.mount("https://", HTTPAdapter(max_retries=retry))
    sess.mount("http://", HTTPAdapter(max_retries=retry))
    sess.headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
    return sess

def load_txt(url):
    """自动兼容 UTF-8 / GBK / GB18030，后缀nzk/txt一律同等解析"""
    sess = get_req_session()
    try:
        resp = sess.get(url, timeout=25)
        resp.raise_for_status()
        # 多编码自动解码，解决GBK乱码
        content = None
        for code in ["utf-8", "gbk", "gb18030"]:
            try:
                content = resp.content.decode(code)
                break
            except UnicodeDecodeError:
                continue
        if not content:
            print(f"⚠️ {url} 编码无法识别，跳过")
            return []

        res = []
        for line in content.splitlines():
            ln = line.strip()
            if not ln or ln.startswith("#"):
                continue
            if "," in ln:
                name, raw_link = ln.split(",", maxsplit=1)
                std_name = get_std_name(name.strip())
                fixed_link = fix_url(raw_link)
                res.append((std_name, fixed_link))
        return res
    except Exception as e:
        print(f"⚠️ 请求 {url} 失败：{e}")
        return []

# 批量拉取所有源
all_source_data = []
for target_url in url_list:
    all_source_data.extend(load_txt(target_url))

# ==========【白名单频道排序清单】==========
order_lines_raw = """

都市剧场



山东文旅
北京影视
天津文艺
北京文艺
新片放映厅
梨园频道


湖南卫视
浙江卫视
东方卫视
江苏卫视
北京卫视

深圳卫视
四川卫视

广东卫视

山东卫视

湖南电影
湖南电视剧
湖南娱乐
广西影视

河南电视剧
峨眉电影
精彩影视
精品剧场
亚洲影院
"""

order_list = [x.strip() for x in order_lines_raw.splitlines() if x.strip()]
std_set = set(order_list)

# 台名归类 + 链接去重
channel = defaultdict(set)
all_got_names = set()
for name, link in all_source_data:
    channel[name].add(link)
    all_got_names.add(name)

# 打印不在白名单的台名，方便补充别名
unknown = all_got_names - std_set
if unknown:
    print("\n=========【陌生台名，可补充别名】=========")
    for u in sorted(unknown):
        print(f'"{u}":"填写标准台名",')
    print("===========================================\n")

# 按顺序导出结果
out_lines = []
for ch in order_list:
    link_list = sorted(channel.get(ch, []))
    for link in link_list:
        out_lines.append(f"{ch},{link}")

file_content = "\n".join(out_lines)
with open("qdyd1.txt", "w", encoding="utf-8") as f:
    f.write(file_content)

print("✅执行完成，已生成 qdyd1.txt")
print(f"一共抓取原始频道数量：{len(all_source_data)}")
print(f"白名单匹配成功频道数量：{len([c for c in order_list if len(channel.get(c,[]))>0])}")

# ================= Gitee完整上传函数 =================
def gitee_upload(content):
    sess=get_req_session()
    api=f"https://gitee.com/api/v5/repos/{GITEE_USER}/{GITEE_REPO}/contents/{GITEE_FILE_NAME}"
    b64=base64.b64encode(content.encode("utf-8")).decode("ascii")
    sha=None
    now_str=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        resp_sha=sess.get(api,params={"access_token":GITEE_TOKEN,"ref":GITEE_BRANCH},timeout=15)
        if resp_sha.status_code==200:
            resp_json = resp_sha.json()
            if isinstance(resp_json,dict) and "sha" in resp_json:
                sha = resp_json["sha"]
                print(f"✅远端文件已存在 sha={sha}")
        elif resp_sha.status_code ==404:
            print("ℹ️远端文件不存在，准备POST新建文件")
    except Exception as e:
        print(f"ℹ️查询远端异常:{e}")
        sha=None
    payload={
        "access_token":GITEE_TOKEN,
        "message":f"自动更新 {now_str}",
        "content":b64,
        "branch":GITEE_BRANCH
    }
    if sha is None:
        res = sess.post(api,json=payload,timeout=20)
    else:
        payload["sha"] = sha
        res = sess.put(api,json=payload,timeout=20)
    if res.status_code in [200,201]:
        print("✅Gitee上传成功！")
    else:
        print(f"❌上传失败 code={res.status_code} {res.text}，返回信息：{res.text}")

#执行上传
gitee_upload(file_content)