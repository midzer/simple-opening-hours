class SimpleOpeningHours {
	/**
	 * Creates the OpeningHours Object with OSM opening_hours string
	 */
	constructor(input: string) {
		this.parse(input);
	}

	public isOpen(date?: Date): boolean {
		if (typeof this.openingHours === "boolean") {
			return this.openingHours
		}
		date = date || new Date()
		const testDay = date.getDay();
		const testTime = date.getHours() + ":" + (date.getMinutes() < 10 ? ("0" + date.getMinutes()) : date.getMinutes())
		let i = 0;
		let times: string[];
		for (let key in this.openingHours) {
			if (i == testDay) {
				times = this.openingHours[key];
			}
			i++;
		}
		let isOpen = false
		times.some(time => {
			const timeData = time.replace(/\+$/, "-24:00").split("-")
			if ((this.compareTime(testTime, timeData[0]) != -1)
				&& (this.compareTime(timeData[1], testTime) != -1)) {
				isOpen = true;
				return true;
			}
		});
		return isOpen;
	}

	/**
	 * Parses the input and creates openingHours Object
	 */
	private parse(input:string) {
		if (/^\s*24\s*?\/\s*?7\s*$/.test(input)) {
			this.openingHours = {
				mo: ["00:00-24:00"],
				tu: ["00:00-24:00"],
				we: ["00:00-24:00"],
				th: ["00:00-24:00"],
				fr: ["00:00-24:00"],
				sa: ["00:00-24:00"],
				su: ["00:00-24:00"],
				ph: ["00:00-24:00"]
			};
			this.alwaysOpen = true;
			return
		} else if (/^.*[0-9]{2}:[0-9]{2}\s*off.*$/.test(input)) {
			this.init();
			return this.parseClosingHours(input);
		} else if (/^\s*off\s*$/.test(input)) {
			this.openingHours = false
			this.alwaysClosed = true
			return
		}
		this.init();
		const parts = input.toLowerCase().replace(/\s*([-:,;])\s*/g, '$1').split(";")
		parts.forEach(part => {
			this.parseHardPart(part)
		});
	}

	private parseClosingHours(input: string){
		let tempData = {
			su: [],
			mo: [],
			tu: [],
			we: [],
			th: [],
			fr: [],
			sa: [],
			ph: []
		};
		let univStart;
		let univEnd;
		const parts = input.toLowerCase().split(";");
		for (let p = 0; p < parts.length; p++){
			parts[p] = parts[p].trim();
			let segments = parts[p].split(' ');
			let days;
			let openTimes = [];
			// If part has the closing hours.
			if (parts[p].indexOf('off') !== -1){
				// If no start or end time is found yet, add part to the end of the list.
				if (univStart == undefined || univEnd == undefined) {
					parts.push(parts[p]);
				} else {
					days = this.parseDays(segments[0]);
					let closeTimes = [];
					// Split closing times into array of times.
					// parts[0]: days, parts[last]: 'off'
					for (let i = 1; i < segments.length - 1; i++) {
						segments[i] = segments[i].replace(',', '');
						let tmp = segments[i].split('-');
						closeTimes.push(tmp[0]);
						closeTimes.push(tmp[1]);
					}
					// Switch closing hours to opening hours.
					for (let i = 0; i < closeTimes.length; i++) {
						if (i == 0) {
							openTimes.push(univStart + "-" + closeTimes[i]);
						} else if (i == closeTimes.length - 1) {
							openTimes.push(closeTimes[i] + "-" + univEnd);
						} else {
							openTimes.push(closeTimes[i] + "-" + closeTimes[++i]);
						}
					}
					days.forEach(day => {
						tempData[day] = openTimes;
					});
				}
			// If part has the universal opening hours.
			} else if (segments.length == 1) {
				let tmp = parts[p].split('-');
				univStart = tmp[0];
				univEnd = tmp[1];
				for (let key in tempData) {
					tempData[key].push(parts[p]);
				}
			// If part has basic opening hours.
			} else {
				let days = this.parseDays(segments[0]);
				openTimes.push(segments[1]);
				days.forEach(day => {
					tempData[day] = openTimes;
				});
			}
		}
		for (let key in tempData) {
			this.openingHours[key] = tempData[key];
		}
	}

	private parseHardPart(part: string) {
		if (part == "24/7") {
			part = "mo-su 00:00-24:00";
		}
		let segments = part.split(/\ |\,/);

		let tempData = {}
		let days = []
		let times = []
		segments.forEach((segment) => {
			if (this.checkDay(segment)) {
				if (times.length == 0) {
					days = days.concat(this.parseDays(segment));
				}
				else {
					//append
					days.forEach((day) => {
						if (tempData[day]) {
							tempData[day] = tempData[day].concat(times)
						}
						else {
							tempData[day] = times
						}
					})
					days = this.parseDays(segment)
					times = [];
				}
			}
			if (this.isTimeRange(segment)) {
				if (segment == "off") {
					times = []
				}
				else {
					times.push(segment)
				}
			}
		})

		//commit last times to it days
		days.forEach((day) => {
			if (tempData[day]) {
				tempData[day] = tempData[day].concat(times)
			}
			else {
				tempData[day] = times
			}
		})

		//apply data to main obj
		for (let key in tempData) {
			this.openingHours[key] = tempData[key];
		}
	}

	private parseDays(part: string): string[] {
		let days = []
		let softparts = part.split(',');
		softparts.forEach((part) => {
			let rangecount = (part.match(/\-/g) || []).length;
			if (rangecount == 0) {
				days.push(part)
			}
			else {
				days = days.concat(this.calcDayRange(part))
			}
		})

		return days
	}

	private init() {
		this.openingHours = {
			su: [],
			mo: [],
			tu: [],
			we: [],
			th: [],
			fr: [],
			sa: [],
			ph: []
		}
	}

	/**
	 * Calculates the days in range "mo-we" -> ["mo", "tu", "we"]
	 */
	private calcDayRange(range: string): string[] {
		let def = {
			su: 0,
			mo: 1,
			tu: 2,
			we: 3,
			th: 4,
			fr: 5,
			sa: 6
		}

		let rangeElements = range.split('-');

		let dayStart = def[rangeElements[0]]
		let dayEnd = def[rangeElements[1]]

		let numberRange = this.calcRange(dayStart, dayEnd, 6);
		let outRange: string[] = [];
		numberRange.forEach(n => {
			for (let key in def) {
				if (def[key] == n) {
					outRange.push(key)
				}
			}
		});
		return outRange;
	}

	/**
	 * Creates a range between two number.
	 * if the max value is 6 a range bewteen 6 and 2 is 6, 0, 1, 2
	 */
	private calcRange(min: number, max: number, maxval): number[] {
		if (min == max) {
			return [min]
		}
		let range = [min];
		let rangepoint = min
		while (rangepoint < ((min < max) ? max : maxval)) {
			rangepoint++
			range.push(rangepoint)
		}
		if (min > max) {
			//add from first in list to max value
			range = range.concat(this.calcRange(0, max, maxval))
		}

		return range;
	}

	/**
	 * Check if string is time range
	 */
	private isTimeRange(input: string): boolean {
		//e.g. 09:00+
		if (input.match(/[0-9]{1,2}:[0-9]{2}\+/)) {
			return true
		}
		//e.g. 08:00-12:00
		if (input.match(/[0-9]{1,2}:[0-9]{2}\-[0-9]{1,2}:[0-9]{2}/)) {
			return true
		}
		//off
		if (input.match(/off/)) {
			return true
		}
		return false
	}

	/**
	 * check if string is day or dayrange
	 */
	private checkDay(input: string): boolean {
		let days = ["mo", "tu", "we", "th", "fr", "sa", "su", "ph"]
		if (input.match(/\-/g)) {
			let rangeElements = input.split('-');
			if (days.indexOf(rangeElements[0]) !== -1
				&& days.indexOf(rangeElements[1]) !== -1) {
				return true
			}
		}
		else if (days.indexOf(input) !== -1) {
			return true
		}
		return false
	}

	/**
	 * Compares to timestrings e.g. "18:00"
	 * if time1 > time2 -> 1
	 * if time1 < time2 -> -1
	 * if time1 == time2 -> 0
	 */
	private compareTime(time1: string, time2: string) {
		const date1 = Number(time1.replace(":", ""))
		const date2 = Number(time2.replace(":", ""))
		if (date1 > date2) {
			return 1
		} else if (date1 < date2) {
			return -1
		} else {
			return 0
		}
	}

	private openingHours: Object | boolean
	private alwaysOpen?: boolean
	private alwaysClosed?: boolean
}
