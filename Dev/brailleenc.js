//"Braille" for bytes encoding - one glyph per byte encoding


//DECODERS
function datedecode(x) { //decode braille to datestring
	months = {0x2800:"Jan",0x2801:"Feb",0x2802:"Mar",0x2803:"Apr",0x2804:"May",0x2805:"Jun",0x2806:"Jul",0x2807:"Aug",0x2808:"Sept",0x2809:"Oct",0x280A:"Nov",0x280B:"Dec"};
	var date = [];
	date[0] = x.charCodeAt(0) - 0x2800; //and stringify for day
	date[1] = months[x.charCodeAt(1)];
	date[2] = x.charCodeAt(2) - 0x2800; //and stringify for year
	datestr = date.join("_");
	return datestr
}

function valdecode(x) { //decode braille sequence to integer lsbyte is 0
	var val = 0x0;
	for(var i = 0;i<x.length;i++) {
			val +=  (x.charCodeAt(i) - 0x2800) << i*8;
	};
	return val;
}

function vectdecode(x) { //(uses valdecode, assumes 32bit chunks)

	var chunk = 4; //8 for 64bit
	buffer = [];
	for(var i = 0; i<x.length;i+=chunk){
		buffer[i] = valdecode(x.substring(i,i+chunk));
	}
	return buffer;
}

function coorddecode(x) { //-> (assumes 0.01 deg accuracy, <256 distinct zooms

	var coord = []; //long,lat,zoom
	coord[0] = valdecode(x.substring(0,2))/100.0;
	coord[1] = valdecode(x.substring(2,4))/100.0;
	coord[2] = valdecode(x.substring(4,6))/100.0;
	coord[3] = (x.charCodeAt(6) - 0x2800) >> 3; //assume 32 max zoom
	return coord;
}

//ENCODERS

function dateencode(d) { //datestr -> braille
	var date = d.split("_");
	months = {"Jan":0x2800,"Feb":0x2801,"Mar":0x2802,"Apr":0x2803,"May":0x2804,"Jun":0x2805,"Jul":0x2806,"Aug":0x2807,"Sept":0x2808,"Oct":0x2809,"Nov":0x280A,"Dec":0x280B};
	buffer = [];
	buffer[0] = +date[0] + 0x2800;
	buffer[1] = months[date[1]];
	buffer[2] = +date[2] + 0x2800;
	return String.fromCharCode(...buffer);
}

function valencode(val,l){ //val to length l string of braille lsb is 0
	var tmp = [];
	for(var i = 0;i<l;i++) {
			tmp[i] = ((val >> (i*8)) & 0xff) + 0x2800; //bytes -> braille
	};
	return String.fromCharCode(...tmp);
}

function vectencode(vector) { //vector -> x [x is 4 codepoints per segment]

	var chunk = 4; //8 for 64bit
	buffer = [];
	for(var i = 0; i<vector.length;i+=1){
		buffer[i] = valencode(vector[i],chunk);
	}
	return buffer.join('');
}

function coordencode(coord) { //coordtriple -> x

	buffer = []
	buffer[0] = valencode(Math.round(coord[0]*100),2);
	buffer[1] = valencode(Math.round(coord[1]*100),2);
	buffer[2] = valencode(Math.round(coord[1]*100),2);
	buffer[3] = String.fromCharCode((coord[3] << 3) + 0x2800);
	return buffer.join('');
}