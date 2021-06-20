function GetTimestamp() {
	let now = new Date();

	return "[" + now.toLocaleString() + "]";
}

async function formatTimeString(date) {
	return new Promise((resolve) => {
		let year = date.getFullYear();
		let month = date.getMonth() + 1;
		let day = date.getDate();
		let hour = date.getHours();
		let minute = date.getMinutes();
		let second = date.getSeconds();

		if (month < 10) { month = "0" + month.toString(); }
		if (day < 10) { day = "0" + day.toString(); }
		if (hour < 10) { hour = "0" + hour.toString(); }
		if (minute < 10) { minute = "0" + minute.toString(); }
		if (second < 10) { second = "0" + second.toString(); }

		let results = year + "-" + month + "-" + day + " @" + hour + ":" + minute + ":" + second;
		return resolve(results);
	});
}

exports.GetTimestamp = GetTimestamp;
exports.formatTimeString = formatTimeString;