from requests import Request, Session
from requests.exceptions import ConnectionError, Timeout, TooManyRedirects
import json
import re

def parse_amount(amount_str):
	# 处理带单位的金额
	unit_multipliers = {
		'k': 10**3,
		'w': 10**4,
		'万': 10**4,
		'亿': 10**8
	}
	match = re.match(r"(\d+)([kw万亿]?)", amount_str)
	if match:
		amount = int(match.group(1))
		unit = match.group(2)
		return amount * unit_multipliers.get(unit, 1)
	return int(amount_str)

def number_to_chinese(num):
	chinese_numerals = "零壹贰叁肆伍陆柒捌玖"
	units = ["", "拾", "佰", "仟"]
	large_units = ["", "万", "亿", "万亿", "亿亿"]
	decimal_units = ["角", "分", "厘", "毫", "丝", "忽", "微"]

	# Convert number to string and split into integer and decimal parts
	num_str = f"{num:.7f}".rstrip('0').rstrip('.')
	integer_part, _, decimal_part = num_str.partition('.')

	# Convert integer part
	chinese_integer = ""
	if integer_part == "0":
		chinese_integer = "零元"
	else:
		integer_part = integer_part.zfill((len(integer_part) + 3) // 4 * 4)  # Pad to multiple of 4
		for i in range(0, len(integer_part), 4):
			part = integer_part[i:i+4]
			chinese_part = ""
			zero_flag = False
			for j, digit in enumerate(part):
				if digit == "0":
					zero_flag = True
				else:
					if zero_flag:
						chinese_part += "零"
						zero_flag = False
					chinese_part += chinese_numerals[int(digit)] + units[3-j]
			chinese_part = chinese_part.rstrip("零")  # Remove trailing zeros
			if chinese_part:
				chinese_integer += chinese_part + large_units[(len(integer_part) - i) // 4 - 1]

	# Convert decimal part
	chinese_decimal = ""
	for i, digit in enumerate(decimal_part):
		if i < len(decimal_units):
			if digit != "0":
				chinese_decimal += chinese_numerals[int(digit)] + decimal_units[i]

	return chinese_integer + "元" + (chinese_decimal if chinese_decimal else "整")

def convert_and_display_currency(api_key, user_input):
	# 中文货币名称映射
	currency_names_zh = {
		"EUR": "欧元",
		"CNY": "人民币",
		"USD": "美元",
		"JPY": "日元",
		"GBP": "英镑",
		"AUD": "澳大利亚元",
		"CAD": "加拿大元",
		"CHF": "瑞士法郎",
		"HKD": "港元",
		"NZD": "新西兰元",
		"SEK": "瑞典克朗",
		"KRW": "韩元",
		"SGD": "新加坡元",
		"NOK": "挪威克朗",
		"MXN": "墨西哥比索",
		"INR": "印度卢比",
		"RUB": "俄罗斯卢布",
		"ZAR": "南非兰特",
		"TRY": "土耳其里拉",
		"BRL": "巴西雷亚尔",
		"TWD": "新台币",
		"MYR": "马来西亚林吉特",
		"THB": "泰铢",
		# 可以根据需要继续添加更多货币的中文名称
	}

	# 使用正则表达式解析用户输入
	match = re.match(r"(\d+[kw万亿]?)(\D+)兑换(\D+)", user_input)
	if not match:
		print("输入格式错误")
		return

	amount_str = match.group(1)
	from_name_zh = match.group(2).strip()
	to_name_zh = match.group(3).strip()

	# 解析金额
	amount = parse_amount(amount_str)

	# 反向查找货币代码
	from_currency = next((code for code, name in currency_names_zh.items() if name == from_name_zh), None)
	to_currency = next((code for code, name in currency_names_zh.items() if name == to_name_zh), None)

	if not from_currency or not to_currency:
		print("无法识别的货币名称")
		return

	# 获取货币符号
	url = 'https://api.xcurrency.com/rate/mid/coins'
	parameters = {
		'apiKey': api_key
	}
	headers = {
		'Accepts': 'application/json'
	}

	session = Session()
	session.headers.update(headers)

	try:
		response = session.get(url, params=parameters)
		data = json.loads(response.text)
		if data['success']:
			currency_symbols = {info['symbol']: info['sign'] for info in data['info'] if info['category'] == 'currency'}
		else:
			print("无法获取货币符号信息")
			return
	except (ConnectionError, Timeout, TooManyRedirects) as e:
		print("请求错误:", e)
		return

	# 进行货币转换
	url = 'https://api.xcurrency.com/rate/mid/convert'
	parameters = {
		'apiKey': api_key,
		'from': from_currency,
		'to': to_currency,
		'amount': amount
	}

	try:
		response = session.get(url, params=parameters)
		data = json.loads(response.text)
		if data['success']:
			rate = data['rates'].get(from_currency)
			if rate:
				from_symbol = currency_symbols.get(from_currency, "")
				to_symbol = currency_symbols.get(to_currency, "")
				chinese_amount = number_to_chinese(rate)
				# Format the result
				output = (
					f"{amount} {from_symbol}{from_name_zh} 兑换为 {to_symbol} {to_name_zh} 的结果是：\n"
					f"数字小写：{rate} {to_symbol}  |  {int(rate):,} {to_symbol}\n"
					f"中文大写：{chinese_amount} {to_symbol} \n"
					" (#Tips:中文大写只计算小数点后7位)"
				)
				print(output)
			else:
				print(f"汇率信息中没有找到 {from_currency} 的汇率")
		else:
			print("API请求未成功")
	except (ConnectionError, Timeout, TooManyRedirects) as e:
		print("请求错误:", e)

if __name__ == "__main__":
	api_key = "" #必填填你的极简汇率API 自行百度找
	user_input = "100k日元兑换人民币" #这里填写你想转换的货币
	convert_and_display_currency(api_key, user_input)
