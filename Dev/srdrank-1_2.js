//hacked together from lots of stuff, as the d3 v3 stuff is more prevalent than d4 see https://bl.ocks.org/iamkevinv/0a24e9126cd2fa6b283c6f2d774b69a2
//http://bl.ocks.org/patricksurry/5721459
//https://bl.ocks.org/lsbardel/374e283b77e531339228e8f22368ae16
//https://jorin.me/d3-canvas-globe-hover/ ?
//https://bl.ocks.org/mbostock/6747043
//https://bl.ocks.org/mbostock/7ea1dde508cec6d2d95306f92642bc42
//   --- dragged sphere scroll from https://bl.ocks.org/mbostock/7ea1dde508cec6d2d95306f92642bc42 --- implement (we have versor.js)
var em; //"global" em-size in pixels determiner from stackoverflow
function getValue(id){
    var div = document.getElementById(id);
    div.style.height = "1em";
    em = div.offsetHeight;
}
getValue("em-div");

//URL querystring parser from stackoverflow (as it makes a nice map)
if (!window.location.query) {
    window.location.query = function (source) {
        var map = new Map();
        source = source || this.search;

        if ("" != source) {
            var groups = source, i;

            if (groups.indexOf("?") == 0) {
                groups = groups.substr(1);
            }

            groups = groups.split("&");

            for (i in groups) {
                source = groups[i].split("=",
                    // For: xxx=, Prevents: [xxx, ""], Forces: [xxx]
                    (groups[i].slice(-1) !== "=") + 1
                );

                // Key
                i = decodeURIComponent(source[0]);

                // Value
                source = source[1]
                source = typeof source === "undefined"
                    ? source
                    : decodeURIComponent(source);

                // Save Duplicate Key
                if (map.has(i)) {
                    if (Object.prototype.toString.call(map.get(i)) !== "[object Array]"){
                        map.set(i, [map.get(i)]);
                    }

                    map.set(i,map.get(i).push(source));
                }
                // Save New Key
                else {
                    map.set(i,source);
                }
            }
        }

        return map;
    }
}

var qrymap = window.location.query(); //get all the query strings in the URL (so you can "start" on a non-default thing)
var mapfile = "small-ctrys-50m-c-10km2-1e6.json" ; //"world-50m.json"
var svg = d3.select("svg"); //svg canvas
var header = d3.select("#header"); //the list header (separate svg)
var header2 = d3.select("#header2");
var div = d3.select("#viewport");
var canvas = d3.select("canvas").node().getContext("2d"); //html5 canvas
var ctytog = 0;
var loctog = false;
var loctog2 = -1;
var r_key; //type of rating
var median; //median rating - for WFTDA SF (which is rating/median)

//country click  -- some odd issues - it seems to ignore changes to the toggle state and just sets all the things checked
d3.select("#ct").on("click",togglectry);
d3.select("#cl").on("click",toggleclique);
d3.select("#sv").on("click", togglepickle);
d3.select("#ATEAM").on("click", minrefresh);
d3.select("#BTEAM").on("click", minrefresh);

function minrefresh(){
    change_filter();
    redraw();
}

function togglectry() {
    //ctytog 1  is country
    if (ctytog != 0) {
        remove_checkboxes('#adv');
    }
    if (ctytog != 1) {
            make_checkboxes('#adv',countries,ctrymask,mb_mask_or,mask_callback(ctrymask, '#adv'));
            ctytog = 1;
    } else {
        ctytog = 0;
    }
};

function toggleclique() {

    if (ctytog != 0) {
        remove_checkboxes('#adv');
    }
    if (ctytog != 2) {
        if (menu_vars.group != 0){
            d3.select("#adv").append("span").attr("class","inputs").text("No cliques outside Group 0!");
        } else {
            make_checkboxes('#adv',cliques,cliquemask,mb_mask_or,mask_callback(cliquemask, '#adv'));
        }
        ctytog = 2;
    } else {
        ctytog = 0;
    }
        //(advtog) ? remove_checkboxes('#advanced') : make_checkboxes('#advanced',countries,ctrymask,mb_mask_or,mask_callback(ctrymask, '#advanced'));
        //advtog = ! advtog;
        //if (ctytog && advtog) {
         //   togglectry(); //can't have countries and advanced at once
        //}
};


function togglepickle() {
    if (ctytog != 0) {
        remove_checkboxes('#adv');
    }
    if (ctytog != 3) {
            make_pickle();
            ctytog = 3;
    } else {
        ctytog = 0;
    }
}

function make_pickle(){
    var adv = d3.select("#adv");
    adv.append("span").attr("class","inputs").text("Not implemented yet!")
    adv.append("input").attr("type","text").attr('class',"inputs").attr("id","textbox");
    adv.append("span").attr("class","inputs").text("SAVE").on("click",save_settings);
    adv.append("span").attr("class","inputs").text("LOAD").on("click",load_settings);
    //adv.append("input").attr("type",); LOAD, SAVE buttons
}

function togglelocator(){
    (loctog) ? removelocator() : makelocator();
    loctog = ! loctog;
}

function makelocator(){ //locator is country picker list -> city picker list -> rotate projection
    d3.select("#locator").style("visibility","visible");
    var locsv = d3.select("#locator svg")
                                .attr("height",Math.round(cities.size()*2.2*em))
                                .selectAll("g").data(cities.keys().sort(),function(d){return d;});
    locsv.exit().remove();

    var gs = locsv.enter().append("g")
        .attr("transform",function(d,i) {return "translate(0,"+Math.round(i*2.2*em)+")";});

    gs.append("rect")
        .attr("fill", "aliceblue")
        .attr("opacity", 0.9)
        .attr("stroke", 'steelblue')
        .attr("width",'10em')
        .attr("height",'2em')
        .on("click",togglelocator2);
    gs.append("text")
        .attr("fill-opacity", 1)
        .attr("x","5")
        .attr("y",'1.2em')
        .text(function(d){return d});
}

function togglelocator2(d,i,nodes){ //city locator
    if (loctog2 > -1) {
        removelocator2(nodes[loctog2]);
    } else {
        makelocator2(d,nodes[i]);
        var country = countries_list.get(d);
        var bb = path.bounds(country), dx = bb[1][0] - bb[0][0], dy = bb[1][1]-bb[0][1];
        var s = 0.8 / Math.max(dx / width, dy / width); //this is totally not going to work for the USA, where we should probably do it by State
        coords = country.properties.centre;
        projection.rotate([-coords[0],-coords[1]]);
        svg.call(zoom.scaleBy,s);
        canvas.beginPath(), canvaspath(country), canvas.fillStyle = "ivory", canvas.fill();
        citiepts = []; cities.get(d).forEach(function(d){citiepts.push([d[0],d[1]])});
        canvas.beginPath(), canvaspath({type:"MultiPoint",coordinates:citiepts}), canvas.strokeStyle="steelblue", canvas.stroke();

    }
    loctog2 = (loctog2 > -1) ? -1 : i;
}  //locator 2 toggles are a bit complicated, as we need to remove the active locator2, not the one that was clicked!

function makelocator2(d,n) {
    d3.select("#locator2").style("visibility","visible");

    n.setAttribute("fill","ivory");
    citieslist = cities.get(d).slice().sort(function(a,b){if (a[3] > b[3]) {return 1;} else if (a[3]<b[3]) {return -1;} return 0;});
    var locsv = d3.select("#locator2 svg")
                                .attr("height",Math.round(citieslist.length*2.2*em))
                                .selectAll("g").data(citieslist,function(e){return e[3];});

    locsv.exit().remove();

    var gs = locsv.enter().append("g").merge(locsv) //.order()ing here doesn't work, I think I need it in a different place?
        .attr("transform",function(d,i) {return "translate(0,"+Math.round(i*2.2*em)+")";});

    gs.append("rect")
        .attr("fill", "aliceblue")
        .attr("opacity", 0.9)
        .attr("stroke", 'steelblue')
        .attr("width",'10em')
        .attr("height",'2em')
        .on("click",zoom2);
    gs.append("text")
        .attr("fill-opacity", 1)
        .attr("x","5")
        .attr("y",'1.2em')
        .text(function(d){return d[3]});
}

function zoom2(d,i,nodes){ //TODO: zoom to country centroid first (on locator), city (and much closer) on locator2
    var country = countries_list.get(d[2]);
    projection.rotate([-d[0],-d[1]]);

    svg.call(zoom.scaleTo,32); //I think this also triggers the zoom effect itself?

    //also need to render cities in the relevant country too, and highlight that country in ivory (toggles on click)
    canvas.beginPath(), canvaspath(country), canvas.fillStyle = "ivory", canvas.fill();

    citiepts = []; cities.get(d[2]).forEach(function(d){citiepts.push([d[0],d[1]])});

    coords = projection([d[0],d[1]]);
    canvas.beginPath(), canvaspath({type:"MultiPoint",coordinates:citiepts}), canvas.strokeStyle="steelblue", canvas.stroke();
    canvas.beginPath(), canvaspath({type:"Point",coordinates: [d[0],d[1]]}), canvas.fillStyle="red", canvas.fill();
    canvas.fillText(d[3],coords[0]+10,coords[1]);
}

function removelocator2(n) {
    n.setAttribute("fill","aliceblue");
    d3.select("#locator2").style("visibility",'hidden');
}
function removelocator(){
    d3.select("#locator").style("visibility",'hidden');
    d3.select("#locator2").style("visibility","hidden"); //need some state management here?
}
//set up variables from querystring, or with defaults otherwise

function modetoggle(){
    modeimg = (map) ? "map-icon.png" : "list-icon.png"; //yes, this is inverted as it's the destination config
    d3.select("#modetoggle").attr("src",modeimg);
    d3.select("#modetoggle").on("click", null);
    if (map==true) {
        map_to_list();
    } else {
        list_to_map();
    }

}


function default_loader() {
    countries = []; //a list of country/bitfield mappings
    genders = [["Women",[0x1]],["Men",[0x2]],["Coed",[0x4]],["Junior",[0x8]]]; //a list of gender / bitfield mappings
    world = 0; //The WORLD MAP

    //a dict, keyed by id
    //teamparse = d3.map(psv.parseRows(teams),function(d) {return d[0];});
    teamparse = [];

    //a list, no key - lookups almost always go towards the teams, not the ratings
    //ratingsparse = psv.parseRows(ratings);
    ratingsparse = [];

    //the sorted ratings (for list) and sorted_map (for map) in a given view
    sortedr = [];
    sorted_map = new Map();

    //ratings possibilities map (source):(list of dates)
    ratingslists = new Map();

    //a dict, keyed by id
    //teamparse = d3.map(psv.parseRows(teams),function(d) {return d[0];});
    teamparse = [];

    //a list, no key - lookups almost always go towards the teams, not the ratings
    //ratingsparse = psv.parseRows(ratings);
    ratingsparse = [];

    //the sorted ratings (for list) and sorted_map (for map) in a given view
    sortedr = [];
    sorted_map = new Map();


    //no query strings passed, use defaults
    map = false;

    //and a mask for the countrys
    ctrymask = [0xffffffff,0xffffffff];

    //default gender mask
    gendermask =[0xf];

    //default selections for menus
    menu_vars = { group: -1, col: 0};

    //the default rating src and date
    defaultsrc = "SRDRank";
    defaultdate = false;

    markerradius = 0.15; //0.05 0.15 0.45

    tooltips = {rs:["Rating Source","Select the Rating kind you want here.<br />The default is the SRDRank, which ranks all the teams who can be ranked (regardless of gender or location).<br />We also offer WFTDA Rankings, with others coming soon.<br />Selecting a type of Rating changes the Dates available to get Ratings for."],
                dt:["Date","Select the Date you want the Ratings from.<br />The available Dates are determined by the Rating Source you chose."],
                rg:["Rating Group","SRD Rank will only compare Groups of Teams who are connected via a chain of games in the last year.<br />Selecting a Rating Group picks one of those Groups to view the Ratings for, for the current Date.<br />(In Map Mode, you can also view ALL Groups to see every team that played at all on the map at once.)"],
                gt:['"Gender" Types','Select the "Gender" of teams you would like to view. The INVERT button reverses the selections.'],
                cg:["Colour Grouping",'Select a system for colouring the teams. Different options will be available based on other choices. In Map mode, all teams of a given colour are grouped under that colour in the icon.<br /><br />"Groups" colours by Rating Group.<br />"Genders" colours by Gender.<br />For Group 0 only, Cliques colours by cliques within Group 0 (see Cliques menu for more info)'],
                ct:["Countries","[Click this button to get the countries tab]<br />Select the countries you would like to see teams for. The INVERT button reverses the selections."],
                cl:["Cliques","[Click this button to get the cliques tab]<br />Select cliques to show.<br />A 'clique' is a set of teams who have played each other a lot, but the outside world much less.<br />As a result, their 'local' ratings are more accurate than their global placement.<br />SRDRank detects cliques as part of the rating process, but only for Group 0, the largest group."],
                sv:["Load/Save","[Click this button to get the load/save tab]<br />Save the current selection and config (as a sequence you can copy and paste), or load a previously saved config.</br >Just copy the textbox contents!"]
    }

    d3.selectAll(".tooltip")
        .each(
            function(){
                p = d3.select(this);
                values = tooltips[this.id];
                p.text(values[0]);
                txt = p.insert("span").attr("class","tooltiptxt");
                txt.html(values[1]);
            }
        );

    //setup marker changes
    mkrcblt = {small:0.05, medium:0.15, large:0.45}
    function mkrcb(val) {
        return function() {
            markerradius = val;
            redraw();
        }
    }

    d3.selectAll(".markersize")
        .each(
            function(){
                p=this.id;
                this.addEventListener("click", mkrcb(mkrcblt[p]));
            }
        );

    modetxt = (map) ? "list-icon.png" : "map-icon.png";
    d3.select("#modetoggle").attr("src",modetxt).on("click", modetoggle);
    d3.select("#locatortoggle").on("click", togglelocator);

    if (qrymap.size > 0){
        console.log(qrymap);
        var tmp = "⢸";
        //set defaultsrc, defaultdate, markerradius
        // map, ctrymask, gendermask, menu_vars from qrymap key:value pairs

        // -- we can encode/decode this as an "efficient" representation in braille unicode points with , as a separator
        // ordering RANKING,date,map,ctrymask,gendermask,grp,col,
        // for bitmasks we can just run together the bitmask values as base32 sequences and split on 4 char limits for 32bit values
        // encode date as single 32bit value for day, month, year [since2000] as three chars
        // encode -1, -2, -3 as z,x,y?
        //   - potentially we can add zoom params / scroll positions at a later date
        // SRDRank,⢸⢸⢸,⢸,⢸⢸⢸⢸⢸⢸f for example

        //tmpvector = qrymap.split(',');
        //defaultsrc = tmpvector[0];
        //defaultdate = datedecode(tmpvector[1]); //need to decode to a date
        //map = valdecode(tmpvector[2]);
        //ctrymask = vectdecode(tmpvector[3]);
        //gendermask = vectdecode(tmpvector[4]);
        //menu_vars.group = valdecode(tmpvector[5]);
        //menu_vars.col = valdecode(tmpvector[6]);
        //if (map > 0) { //zoom param restore
        //    //pickled rotate
        //    rotate = tmpvector[7].split().forEach(valdecode(d)) //see coorddecode - although we need 3 ele,ments
        //        projection.rotate() gives 3
        //    //and zoom
        //    zoom = valdecode(tmpvector[8]);
        //          projection.scale(); //possibly rescaled by scale0  - we need to set zoom's k to the right value too!
        //}

        //TODO: also save
    }

    //sequencing
    // if this is first load, we need to
    //load all the initial data
    //d3.queue()
    //    .defer(d3.text, "SRDRankList.out")
    //    .defer(d3.text, "teams-vector.uniform")
    //    .defer(d3.text, "country-vector.uniform")
    //    .await(ready_initial);

    //otherwise, we just need to refresh the menus etc which have already been built (that is,
}

//wrapper for callback
function load_settings(){
    load_settings_(d3.select("#textbox").attr("value"));
}

function load_settings_(setting){
    tmpvector = setting.split(',');
    defaultsrc = tmpvector[0];
    defaultdate = datedecode(tmpvector[1]); //need to decode to the right format for defaultdate - is that the date or the path?
    var map_ = valdecode(tmpvector[2]);
    ctrymask = vectdecode(tmpvector[3]);
    cliquemask = vectdecode(tmpvector[4]);
    gendermask = vectdecode(tmpvector[5]);
    menu_vars.group = valdecode(tmpvector[6]);
    menu_vars.col = valdecode(tmpvector[7]);
    rotatetmp = coorddecode(tmpvector[8]) //see coorddecode - although we need 3 ele,ments
    var rotate_ = rotatetmp.slice(0,3);
    var zoom_ = rotatetmp[3];

    //load rankings
    d3.select("#type select").property("value",defaultsrc);
    type_menu_callback(defaultsrc+"/"+defaultdate+".out");

    if (map_ != map){
        (map_) ? list_to_map() : map_to_list();
    }
    //and projection fiddle - this should be done via zoom callback
    projection.rotate(rotate_);
    projection.scale(scale0*zoom_);

    redraw();

    //          projection.scale(); //possibly rescaled by scale0  - we need to set zoom's k to the right value too!
}

function save_settings(){
    //varencode stuff in sequence, no need to worry about manipulating state here, much easier than loading
    tmpvector = [];
    tmpvector[0] = d3.select("#type select").property("value"); //GOOD
    var tmp = d3.select("#dates select").property("value");
    tmpvector[1] = dateencode(tmp.slice(tmpvector[0].length+1,tmp.length - 3)); //need to decode to a date, so we need to slice out the bit that's a date
    tmpvector[2] = valencode(map,1); //GOOD
    tmpvector[3] = vectencode(ctrymask); // GOOD
    tmpvector[4] = vectencode(cliquemask); //GOOD
    tmpvector[5] = vectencode(gendermask);  //GOOD
    tmpvector[6] = valencode(menu_vars.group,1);
    tmpvector[7] = valencode(menu_vars.col,1);
    if (projection){
        rotatetmp = projection.rotate();
        rotatetmp.push(projection.scale / scale0);
    } else {
        rotatetmp = [0,0,0,1];
    }
    //if (map > 0) { //zoom param restore
    //    //pickled rotate
    tmpvector[8] = coordencode(rotatetmp); //see coorddecode - although we need 3 ele,ments
    //        projection.rotate() gives 3
    //    //and zoom
    d3.select("#textbox").attr("value", tmpvector.join());  //

}

var markerradius;
var cliques;
var defaultsrc = "SRDRank";
var defaultdate = false;

var map = true;
// ******************** FIRST GET OUR DATA **************************************
var psv = d3.dsvFormat("|");
var ratingslists = new Map();

//a dict, keyed by id
//teamparse = d3.map(psv.parseRows(teams),function(d) {return d[0];});
var teamparse = [];

//a list, no key - lookups almost always go towards the teams, not the ratings
//ratingsparse = psv.parseRows(ratings);
var ratingsparse = [];

//the sorted ratings (for list) and sorted_map (for map) in a given view
var sortedr = [];
var sorted_map = new Map();

var countries = []; //a list of country/bitfield mappings
var cities; //city finder map
var cliques; // list of cliques

var ctrymask = [0xffffffff,0xffffffff];
var cliquemask = [0xffffffff,0xffffffff];

var world = 0;

var genders;
var gendermask =[0xf];

var menu_vars = { group: -3, col: 0}

default_loader();

// return true if *any* of the sub-bitfields in list match their mask
// (so this is a short-circuit reduction of "or"s of bitfield "and")
var mb_mask_or = function(mask,list) {
    for(var i=0;i<mask.length;i++) {
        var s = mask[i] & list[i];
        if (s != 0) {
            return true;
        }
    }
    return false;
    //return d3.zip(mask,list).reduce(function(a,b) {return a || ((b[0] & b[1]) != 0);});
}

//also need mb_mask_and, which is the correct implementation for a region checkbox value - as it should only be checked if *all* its countries are
// mask here is the *region* mask for the button
var mb_mask_and = function(mask,list) {
    for(var i=0;i<mask.length;i++) {
        var s = mask[i] & list[i];
        if (s != mask[i]) {
            return false;
        }
    }
    return true;
    //return d3.zip(mask,list).reduce(function(a,b) {return a || ((b[0] & b[1]) != 0);});
}

//general mask calculator
function calc_mask(variablemask,selector_id) {
        //calculate the bitmask from the checkboxes
        for(var i=0;i<variablemask.length;i++)
        {
        variablemask[i] = 0x0;
        }
        d3.select(selector_id).selectAll("input").each(function(d) {
            cb = d3.select(this);
            if (cb.property("checked")){
                //console.log(d);
                for(var i=1;i<d.length;i++) {
                    variablemask[i-1] = variablemask[i-1] | d[i];
                }
            };
        });
    }


//create a generic mask update callback
function mask_callback(variablemask, selector_id) {
    return function() {
        calc_mask(variablemask,selector_id);
        change_filter();
        redraw();
    }
}


//generic checkbox maker - need id to match, data-in, variable to mask, mask_selection_function, callback
function make_checkboxes(divid,fields,variable,mb_func, callback) {
    var opts = d3.select(divid).selectAll(".inputs").data(fields);
    //spans above contain a checkbox each

    opts.exit().remove();

    //add the new spans, with labels by d[0]
    var cspans = opts.enter().insert("span").attr("class",function(d){ return "inputs x"+(+d[1]).toString(16);}).text(function(d) {return d[0];});

    //and add the inputs, with value by d contents
    cspans.append("input")
        .attr("type","checkbox")
        .attr("value",function(d) {return d.slice(1);})
        .attr("checked", function(d) {return mb_func(d.slice(1),variable) ? "checked" : null;}) //mb_func will be mb_mask_or or mb_mask_and depending on if this is a single-value or mass-value checkbox
        .on("change",callback);

    //update existing
    opts.selectAll("input").attr("checked", function(d) {return mb_func(d.slice(1), variable);});
    //checker
    //cspans.merge(opts).order().filter(function(d, i) { return i & 1; }).style("background-color","ghostwhite");

    //make an "invert" button which inverts the selection
    var selection = d3.select(divid).selectAll("input");

    function invert_callback(select_, callback_){
        return function() {
            select_.each(function(d){this.checked = !this.checked; calc_mask(variable,divid);}); //doing things this way enforces the "control" inversion in the easiest to understand way
            callback_(); // just in case the callback does something special!
            //change_filter();  //we do the "slow" change_filter once, when we're back in a sane state.
            //redraw();
        }
    }
    d3.select(divid).selectAll(".invert").data([true],function(d) {return d}).enter().append("span").text("INVERT").attr("class","invert").on("click",invert_callback(selection, callback));
}

//generic checkbox remover, where _ is an id for a menu container
function remove_checkboxes(_) {
    d3.select(_).selectAll(".inputs").remove(); //remove all spans inside container, along with their checkboxes
    d3.select(_).select(".invert").remove();
}

function update_menu(selector,data,callback,deflt) {
    var menu = d3.select(selector + " select").on("change",callback);
    menu_opts = menu.selectAll("option").data(data,function(d){return d[1]});
    menu_opts.exit().remove();
    menu_opts.enter().insert("option")
        .attr("value", function(d){return d[1];})
        //.merge(menu) //we might need to update text on the existing items
        .text(function(d) {return d[0];});

    menu.property("value", deflt);
}

function menu_callback(selection,varname){
    return function(){
        //console.log(menu_vars[varname]);
    menu_vars[varname] = d3.select(selection + " select").property("value");
    if (varname == "group"){
        listcomp = null; //can't keep a selector for comparison outside the group
    }
        //console.log(menu_vars[varname]);
    change_filter(); //if map mode, as we group by key (don't need to do this for list mode as we just colour by key)
    redraw();
    }
}


//new version
function load_ranking(ranking){
    //grey out menus?

    d3.queue()
        .defer(d3.text, ranking)
        .await(processranking);
}

function processranking(error, ratinglist) {
    ratingsparse = psv.parseRows(ratinglist);
    //make cliquelist before we bitfield cliques!
    grp0 = ratingsparse.filter(function(e){return e[1] == 0});
    var clique_num = grp0.reduce(function(a,cv){return +a < +cv[2] ? cv[2] : a},0);
    cliques = [];
    for (var i = 0; i<=clique_num;i++){
        if (i<32){
            cliques[i] = [i,(1<<i),0];
        } else {
            cliques[i] = [i,0,(1<<(i-32))];
        }
    }
    var flag = 0; //flag for finding listcomp values
    if (listcomp!==null){
        flag = 1;
    }
    for(var i=0;i<ratingsparse.length;i++){
        if (ratingsparse[i][2] < 32){ //map cliques to [,] bitfields - this would be so much easier if javascript was 64bit native
            ratingsparse[i][2] = [1<<ratingsparse[i][2],0];
        } else {
            ratingsparse[i][2] = [0,1<<ratingsparse[i][2]-32];
        }
        ratingsparse[i].push(i+1); //column 8, used for local ordering
        ratingsparse[i].push(...(teamparse.get(ratingsparse[i][0]).slice(1))); //splice the relevant teams info to the end of the list
        if (listcomp!==null){
            if (ratingsparse[i][0] == listcomp[0]){
                listcomp = ratingsparse[i];
                flag = 0;
            }
        }
        //new indices are: 9 (=1 in team) NAME, 10 LEAGUE, 11 , 12 GENUS, (13,14) LAT LONG, (15,16) COUNTRY BIT VECTOR
    }

    median = 300/ratingsparse[Math.round(ratingsparse.length/2)][3]; //for WFTDA SF calc

    if (flag == 1) {
        //we didn't find that team in this ranking :(
        listcomp = null;
    }

    var groupslist = [];
    numgrps = ratingsparse[ratingsparse.length-1][1];
    for(var i=0;i<=numgrps;i++){
        groupslist.push([i,+i]);
    }
    groupslist.unshift(["ALL",-1]);

    if (menu_vars["group"] >= numgrps) {
        menu_vars["group"] = -3; //if we have no group to map to now, unset to defaults
    }
    if (menu_vars["group"] == -3) { //no defaults mode
        menu_vars["group"] = 0;
        if (map == true) {
            //groupslist.unshift(["ALL",-1]); //all option for maps only
            menu_vars["group"] = -1;
        }
    }

    update_menu("#group",groupslist,menu_callback("#group","group"), menu_vars["group"]);

    //unique groups in ratings - ratings are sorted by group internally, so we can just take the last entry's group as the highest value
    //ungrey menus ?
    if (map != true) { //unselect ALL as possible if list mode
        d3.select("#group select option").attr("disabled",true);
    }
    change_filter();
    redraw();
}


//load all the initial data
d3.queue()
    .defer(d3.text, "SRDRankList.psv")
    .defer(d3.text, "teams-vector.uniform")
    .defer(d3.text, "country-vector.uniform")
    .defer(d3.text, "cities-vector.uniform")
    .await(ready_initial);

function make_type_menu(defaultsrc, defaultdate=false){
    var menu = d3.select("#type select").on("change",type_menu_callback);
    //menu_opts = menu.selectAll("option").data(["SRDRank","Banana"],function(d){return d;});
    menu_opts = menu.selectAll("option").data([...ratingslists.keys()],function(d){return d;});
    menu_opts.exit().remove();
    menu_opts.enter().insert("option")
        .attr("value", function(d){return d;})
        .merge(menu) //we might need to update text on the existing items
        .text(function(d) {return d;}); //set an image (at d+'/icon.png') too?

    menu.property("value", defaultsrc); //default to SRDRank
    type_menu_callback(defaultdate);
}

function date_menu_callback(){
    var ratingfile = d3.select("#dates select").property("value");
    load_ranking(ratingfile);
}

function type_menu_callback(defaultdate=false){
    r_key = d3.select("#type select").property("value");
    var dates = ratingslists.get(r_key)
    var menu = d3.select("#dates select").on("change",date_menu_callback);
    menu_opts = menu.selectAll("option").data(dates,function(d){return d[1]});
    menu_opts.exit().remove();
    menu_opts.enter().insert("option")
        .attr("value", function(d){return r_key+'/'+d[1]+'.out';})
        .merge(menu) //we might need to update text on the existing items
        .text(function(d) {return d[1];});

    if (defaultdate != false){
            menu.property("value",defaultdate);
            date_menu_callback();
    } else { //default to the last entry for the default type
        menu.property("value", r_key + '/' + dates[dates.length -1][1] + '.out')
        date_menu_callback();
    }
}


function ready_initial(error, ratinglist, teamdata, countrydata, citydata) {
    if(error) return console.log("error: " + error.responseText);
    teamparse = d3.map(psv.parseRows(teamdata), function(d) {return d[0];}); //map by teamid
    countries = psv.parseRows(countrydata);

    cities = d3.nest()
        .key(function(d){return d[2];})
        .map(psv.parseRows(citydata)); //lon,lat,contry,city

    ratingslists = d3.nest().key(function(d){return d[0];}).map(psv.parseRows(ratinglist)); //map dirname(ratingtype)

    make_type_menu(defaultsrc);
    //type menu gets keys
    // date menu is updated once you pick a key
    make_checkboxes('#gender',genders,gendermask,mb_mask_or,mask_callback(gendermask, '#gender'));

    //if we're starting in map mode, then asynchronously load and initialise the map state
    if (map == true) {
        d3.queue().defer(d3.json, mapfile)
            .await(processmap);
    } else {
        init_list();
    }
}

//what do do when we have the data - make our arrays and generate our initial interface
// -> move to two phase for this
//    -> above queue should queue up (teamdata, countrydata, rankings_list)
//          -> ready initial builds rankings selection menus, gender menu, teamparse, countries, regions, (igb)
//              -> selects default ranking (the most recent SRDRank)
//                  queues up (rating_data)
//                      -> ready rating builds ratingsparse, groupslist, (subgroupslist), groups menu, (subgroups menu)
//                          -> builds default view (list)
// (switching to map view loads the map data, if it hasn't been loaded already)


//**********    DATA GOT - BUILD SVG & MENUS *************************


//we should probably get these from the bounding box of the svg or its div
var width = 40*em;
var height = 40*em;

//hand-picked
var scale0 = 300; //this is good for square svg of side 750 or so at smallest, should scale linearly for other dimensions

var radii = [0.08,0.15,0.3]; //"marker sizes" for small, med, large

//will hold a selection for the teams, but not sure if we actually need it
var g, group;

// **************************** MAP STUFF
//need to be global state, sadly, for map refreshes
var projection;
var path, canvaspath;
//zoom property for map
var zoom = d3.zoom().
    scaleExtent([1, 32])
    .on("zoom",zoomed)
    .on("start",zoomstart);

//svg
//    .call(zoom); //needs to happen in init_map

var v0,r0,q0; //zoom tracking

function zoomstart(){
    //init versor
    v0 = versor.cartesian(projection.invert(d3.mouse(this)));
    r0 = projection.rotate();
    q0 = versor(r0);
}
function zoomed() {
    zoom_trans = d3.event.transform; //get the transform
    var v1 = versor.cartesian(projection.rotate(r0).invert(d3.mouse(this))),
    q1 = versor.multiply(q0, versor.delta(v0, v1)),
    r1 = versor.rotation(q1);
    projection
        .rotate(r1)
        .scale(scale0*zoom_trans.k); //update the projection
    render();
    svg.selectAll("path").attr("d", path); //update all the paths which were projected
}
//*************************** END MAP STUFF

//colourscheme menu, register the global list change redraw function for any changes
colorschemas = [ ["Gender",0],["Cliques",1], ["Groups",2] ]

update_menu("#menu",colorschemas,menu_callback("#menu","col"),0);


//clique bitfield colours - need at least 20 here!
// - also not yet a bitfield :(
// colorbrewer v2 8 colour set : ['#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00','#ffff33','#a65628','#f781bf']
// - using one of the d3 colour schemes, unpacked via python script to a map
//     //   .set(0,'papayawhip')
    //   .set(1,'powderblue')
    //   .set(2,'honeydew')
scolmap = d3.map()
        .set(0x1,'#1f77b4')
    .set(0x2,'#aec7e8')
    .set(0x4,'#ff7f0e')
    .set(0x8,'#ffbb78')
    .set(0x10,'#2ca02c')
    .set(0x20,'#98df8a')
    .set(0x40,'#d62728')
    .set(0x80,'#ff9896')
    .set(0x100,'#9467bd')
    .set(0x200,'#c5b0d5')
    .set(0x400,'#8c564b')
    .set(0x800,'#c49c94')
    .set(0x1000,'#e377c2')
    .set(0x2000,'#f7b6d2')
    .set(0x4000,'#7f7f7f')
    .set(0x8000,'#c7c7c7')
    .set(0x10000,'#bcbd22')
    .set(0x20000,'#dbdb8d')
    .set(0x40000,'#17becf')
    .set(0x80000,'#9edae5');


//gcolmapf = function(d) { return gcolmap.get(+teamparse.get(d[0])[4]); }; = d[12] in new version of spliced ratings with teams stuck on
//scolmapf = function(d) { return scolmap.get(+d[2]); };
gcolmapf = function(d) { return d[12]; }; //genus
scolmapf = function(d) { return +d[2][0]; }; //clique - can be >32 :()
grcolmapf = function(d) { return 1<<+d[1]; } //group
//will probably have other colourschemes to add to the colmap later...
colmap = [gcolmapf,scolmapf, grcolmapf];


//
var redraw = redraw_list; //our default redraw is the list

function map_to_list(){
    destroy_map();
    map = false;
    //remove 'ALL' option from groups menu
    // and set default to 0 if it was set to 'ALL'
    init_list();
    redraw = redraw_list;
    if (sortedr.length > 0){
        redraw();
    }
    d3.select("#modetoggle").on("click", modetoggle);
}


//just generate the new filter
function change_filter() {
    // there's an argument here for refactoring this to reduce unnn
    var gkey = gendermask[0];//genderm.property("value");
    var ckey = menu_vars.col; // this is actually needed to colour actual items
    var a_tog = d3.select("#ATEAM").property("checked") ? true : false;
    var b_tog = d3.select("#BTEAM").property("checked") ? true : false;

    //todo: add "range of rankings" selector
    //todo: add "located within this distance" selector
    console.log(d3.select("#ATEAM").property("checked"));
    var groupvar = menu_vars.group;
    //first filter selects the "dominant" group, group 0,
    // second is country filter
    // then gender filter
    var filterr = ratingsparse
        .filter(function(e){return (groupvar == -1) ? true : (e[1] == groupvar);}) //dominant group is group 0 (the main ranking group), groupmask = -1 means "all groups"
        .filter(function(e){ return (groupvar != 0) ? true : mb_mask_or(e[2],cliquemask);}) //need to bitfield cliques!
        .filter(function(e) {return mb_mask_or(e.slice(15,17),ctrymask);}) //team index 7,8,9 = spliced rating 15,16,17
        .filter(function(e) {return (a_tog) ? e[11] == "Travel Team" : true;}) //Travel Team only filter
        .filter(function(e) {return (b_tog) ? e[11] == "B Team" : true; }) //B Team only filter
        .filter(function(e) { return (e[12] & gkey) != 0 ; }); //team index 4 is spliced rating 12
    //sort on... currently just the actual ranking (which we assume people most care about)
    //sortedr is global, and our actual "list"
    sortedr = filterr.sort(function(a,b) { return a[7]-b[7]; });
    if(groupvar == -1) {
        for(var i=1;i<=sortedr.length;i++){
            sortedr[i-1][8] = ""; //update "local ordering" (if we're in ALL Groups mode, we would set this to Null)
        }
    } else {
        for(var i=1;i<=sortedr.length;i++){
            sortedr[i-1][8] = i; //update "local ordering" (if we're in ALL Groups mode, we would set this to Null)
        }
    }
    //if groupvar is not -1, we can determine a filter-local ranking by order in the sorted list

    if (map) { //only make these if in map mode
        //sorted map is the grouped version for maps, keyed by [long,lat] - we use a nest here because javascript maps compare keys by identity (so we can't key on arrays)
        sorted_map = d3.nest()
            .key(function(d) {return d[14]}) //long - team index 6, spliced rating index 14
            .key(function(d) {return d[13]}) //lat  - team index 5, spliced rating index 13
            .key(colmap[ckey]) //"color class selector"
            .map(sortedr);
        //need the "keys list" too for the groupings (this is the merged set of keys = coordinate pairs)
        sorted_coords = [];
        sorted_map.keys().forEach(function(d){ sorted_map.get(d).keys().forEach(function(k) {sorted_coords.push([d,k]);} );});
    }
}

function list_to_map(){
    destroy_list();
    map = true;
    //add 'ALL' option back to groups menu
    change_filter(); //need to get the sorted_map datastructures

    if (world == 0) { //if we've not loaded a map data yet
        d3.queue().defer(d3.json, mapfile) //world-50m.json world-110m.json
            .await(processmap);
        return
    }
    init_map(); //otherwise, init the map, as we have the world
    redraw = redraw_map;
    if (sorted_map.size != 0){ //check there's data to draw
        redraw();
    }
    d3.select("#modetoggle").on("click", modetoggle);
}

//deferred switch for loading data
function processmap(error, worlddata){
    world = worlddata;
    bb = div.node().getBoundingClientRect();
    //get size of our rectangle
    dims = bb.bottom - bb.top;
    //and initialise projection etc here, as it needs done exactly once
    projection = d3.geoOrthographic().translate([dims/2,dims/2]).scale(scale0);  // we probably need to adjust scale0 dynamically for screensize
    //projection = d3.geoPolyhedralWaterman().center([2.4,54]).scale(2000);
    path =  d3.geoPath().projection(projection); //needed to allow path projection
    canvaspath = d3.geoPath().projection(projection).context(canvas); //path for canvas drawing

    //draw graticules  - these guys should all be in the defer on map load, as we need to make them exactly 1nce
    graticule = d3.geoGraticule10(); //canvas version - render needs this
    //draw countries
    countries_path = topojson.mesh(world, world.objects["small-ctry-50m-withcentre"]); //canvas version - render needs this
    //need to roll our own topoJSON with world country names embedded for this to work
    countries_list = d3.map(topojson.feature(world, world.objects["small-ctry-50m-withcentre"]).features,function(d) { return d.properties.name; });
    init_map();
    redraw = redraw_map;
    if (sorted_map.size != 0){ //check there's data to draw
        redraw();
    }
    d3.select("#modetoggle").on("click", modetoggle);
}

function render(){
    //bb = div.node().getBoundingClientRect();
    //width = bb.right - bb.left;
    //canvas.canvas.width = width;
    //canvas.canvas.height = width;
    //console.log(graticule);
    canvas.clearRect(0, 0, width, width); //clear the canvas - get width, height from bbox, we are *square*
    canvas.beginPath(), canvaspath({type: "Sphere"}), canvas.fillStyle = "#fff", canvas.fill(); //the canvaspaths here are not doing anything
    canvas.beginPath(), canvaspath(graticule), canvas.strokeStyle = "#ddd", canvas.stroke();    //something *weird* about our bounding rect, which seems to be v small
    canvas.beginPath(), canvaspath(countries_path), canvas.strokeStyle = "#666", canvas.stroke();    //(if we zoom in, so stuff drawn in top left, we see in in a v small box there)
    //context.beginPath(), canvaspath(cities), canvas.strokeStyle = "#ddd", context.stroke(); //when we have cities
}

var countries_path, graticule, countries_list;

//this needs to be hidden, as it's a deferred thing, if we don't have world data
function init_map(){

    bb = div.node().getBoundingClientRect();
    width = bb.right - bb.left;
    canvas.canvas.width = width;
    canvas.canvas.height = width;
    d3.select("#group select option").attr("disabled",null); //enable ALL group

    div.style("overflow-y","visible"); //remove scrolly from div
    dims = svg.attr("width");
    svg.attr("height",dims); //experimental, make svg "square"

   group = svg.insert("g").attr("class","maplayer");

   //canvas context for rendering map itself

    //function to initialise the map projection representation (including making the globe itself)

    d3.selectAll("#markertoggle").style("visibility","visible");
    d3.selectAll("#locatortoggle").style("visibility","visible");
    //based on several sources, including https://medium.com/@ttemplier/map-visualization-of-open-data-with-d3-part3-db98e8b346b3
// and Mike Bostock's plentiful tutorials and examples

    render(); //canvas draw version
    //add team icons layer
    g = group.insert("g").attr("class","teams"); //team icons are "under" tooltips

    //add "size of marker" selectors


    //add tooltips layers
    group.insert("rect")
        .attr("height",2*em)
        .attr("width",10*em)
        .attr("fill",'aliceblue')
        .attr("stroke-width", '1px')
        .attr("stroke","steelblue")
        .attr("id","tooltip-map")
        .style('display', 'none');
    group.insert("g")
        .attr("id","tooltip-map-text")
        .style('display', 'none');

     svg.call(zoom); //add the zoom callbacks for panning etc  <-- this doesn't work with group, at least starting in list mode and switching to map
}

function destroy_map(){
    width = canvas.canvas.width;

    //clean up map svg etc
    svg.on(".zoom", null); //remove the zoom handlers  - we should save these for reapplication if we return to the map (also for state pickling and restore in general)
    group.remove();
    sorted_map.clear(); //let the memory handlers clean some stuff up
    canvas.clearRect(0, 0, width, width); //clear the canvas, we are *square* - this *doesn't work* after a rotation has happened?! (until we've init-mapped again)
}

function redraw_map() {
//draw map from some topoJSON with path projection above

// the map takes a different multi-level map data structure to the list mode
// map is a nested map with keys: lon, lat, (colour scheme selector)
//   - we use the outer two keys to group the teams in the same location, with the help of sorted_coords, which is a list of all coordinate pairs to expect
//   - storing some intermediate results as local data on the g nodes for each coordinate for ease of access...
//       - we then make pie charts with one segment for each unique (selector value) at that coordinate
//         - the tooltips generate info for each team grouped under a given segment

     var coord = d3.local(); //for coordinate location
     var map_frame = d3.local(); //for intermediate dictionary keyed at that coordinate
     var klength = d3.local();
     var ckey = menu_vars.col;
    //"containers" for each coordinate point
    circs = g.selectAll('g')
     .data(sorted_coords, function(d) { return d;});

    circs.exit().remove();

     //this logic needs to happen for the enter() gs, and *also* the update set, as we need to check every value-list for changes
    //decorated containers with local data
    circs_ = circs.enter()
    .insert("g").merge(circs).each(function(d) {
        coord.set(this, d);
        map_frame.set(this,sorted_map.get(d[0]).get(d[1]));
        klength.set(this,sorted_map.get(d[0]).get(d[1]).size());
        });

    //our pie literally just makes equally divided arcs so they need equal weights
    //this is the loop-unrolled version of the function, which emits GeoJSON polygons decorated with the original datum in a data: field
    //suitable for preprocessing of data into "path data" in a .data() join
    function geoArc(center, radius, data){
        polygons = [];
        var numElems = data.length;
        if (numElems == 1) { //fast for triangles, unrolled loop
            var coordinates = [];
            coordinates[0]=d3.geoRotation([center[0],0])(d3.geoRotation([0,center[1]-90])([0,90-radius]));
            coordinates[1]=d3.geoRotation([center[0],0])(d3.geoRotation([0,center[1]-90])([-120,90-radius]));
            coordinates[2]=d3.geoRotation([center[0],0])(d3.geoRotation([0,center[1]-90])([-240,90-radius]));
            coordinates[3]=coordinates[0];
            polygons[0] = {
                type: "Polygon",
                coordinates: [coordinates],
                data: data[0]
            };
            return polygons;
        }
        var rangeAngle = 180 / numElems;
        for(var elemNum=0;elemNum<numElems;elemNum++){
            var coordinates = [];
            var startAngle = rangeAngle * elemNum * 2;
            coordinates[0]=d3.geoRotation([center[0],0])(d3.geoRotation([0,center[1]-90])([-startAngle,90-radius]));
            coordinates[1]=d3.geoRotation([center[0],0])(d3.geoRotation([0,center[1]-90])([-startAngle-rangeAngle,90-radius]));
            coordinates[2]=d3.geoRotation([center[0],0])(d3.geoRotation([0,center[1]-90])([-startAngle-(rangeAngle*2),90-radius]));
            coordinates[3]=center;
            coordinates[4]=coordinates[0];
            polygons[elemNum] = {
                type: "Polygon",
                coordinates: [coordinates],
                data: data[elemNum]
            }
        }
        return polygons;
    }

    //make the little pie charts for each location
    //these are little geoJSON paths so we can clip and transform them with the projection for efficiency
    cgcs = circs_.selectAll("path").data(function(d) { return geoArc(coord.get(this),markerradius,[...sorted_map.get(d[0]).get(d[1]).keys()]);},function(e) {return e.data;}); //the colour selector keys

     //utility function for the info text for a given team
     var linegen = function(d){
            //return teamparse.get(d[0])[1]; //teamnames, one per tspan, so we can align them
            var name = d[9];
            if (d[11]=="Travel Team"){
                name += " A";
            }
            var text_field = name + " Rank: " + d[7]+ " in Group " + d[1]; //teams index 1 is ratings spliced index 9
            return text_field;
        }

    cgcs.exit().remove();
    cgcs.enter().append("path").merge(cgcs)
    .style("fill", function(d) {return scolmap.get(d.data);}) //the data key is always a bitfield key, and so can be used to get from scolmap
    .style("fill-opacity",0.5)
    .style("stroke", 'black') //need to get a "border colour here"
    .style("stroke-width", "0.5px")
    .attr("clip-path", "url(#clip)")
    .attr("d", path)
    .on('mouseover', function(d, i) {   //tooltip on mouseover
        var teamlist = map_frame.get(this).get(d.data); //list of teams
        var teammap = d3.nest().key(function(e){return e[11]=="Travel Team" ? e[9] : e[10];}).map(teamlist); //key by leaguename
        var leagues = [...teammap.keys()];

        var lengthmap = {};
        lengthmap[leagues[0]] = 0;  //map of lengths
        var accum = 0;
        for (var i=1;i<leagues.length;i+=1){
            accum += teammap.get(leagues[i-1]).length + 2
            lengthmap[leagues[i]] = accum;  //length of previous leagues' teamlist for offset
        }
        var c = [15,15]; //fixed corner location for now

        //for each key():
        //  text(key)
        //     for each val:
        //          linegen(val)
        //one tspan per team
        txt = svg.select('#tooltip-map-text').style('display', 'inline')
          .attr("x", (c[0] + 25))
          .attr("y", (c[1] + 35))
          .selectAll('text')
          //.data(teamlist,function(e){return e[0];});
          .data([...teammap.keys()],function(e){return e;});

        txt.exit().remove();

        //tspans for presentation
        txtenter = txt.enter().append('text')
           .attr("class","leaguename")
          .attr("x",(c[0] + 25))  // these overlap :( for more than 1 league
          .attr("y",function(d){return (c[0] + 35 + lengthmap[d]*em);}) //y is offset by number of teams in league to show
          //  .attr("dy","1.2em")
          .merge(txt)
          //.text(d)
          //.selectAll('tspan').data(function(d){teammap.get(d);},function(d){return d[0];})
            .text(function(d){return d;});

        txtenter.selectAll('tspan').data(function(d){return teammap.get(d);},function(e){return e[9];})
            .enter()
            .append("tspan")
            .attr("x",(c[0] + 35))
            .attr("dy","1.2em")
            .text(linegen);
            //foreach key: get values (for each value add a tspan)

        //something like txt.node().getBBox() - size of text itself
        bbox = svg.select('#tooltip-map-text').node().getBBox();

        svg.select('#tooltip-map').style('display', 'inline')
          .attr("width",bbox.width+20)
          .attr("height",bbox.height+20) //em*(1.2*teamlist.length)+30)
          .attr("x", (c[0] + 15))
          .attr("y", (c[1] + 15));
      })
      .on('mouseout', function(d, i) {
        svg.select('#tooltip-map').style('display', 'none');
        svg.select('#tooltip-map-text').style('display', 'none');
      });

}

function init_list(){
    gmenu = d3.select("#group select");
    if (menu_vars.group == -1) { //can't allow "all" selection in list mode
        gmenu.property("value",0); //doesn't seem to change selection?
        menu_vars.group = 0;
        change_filter();
    }
    ALLoption = gmenu.select("option");

    ALLoption.attr("disabled",true); //disable ALL group
    //show the header
    header.style("visibility","visible");

    //initialise the list svgs etc - this is shifted down one for the header
    group = svg.insert("g").attr("class","listlayer").attr("transform","translate(0,"+Math.round(2.3 *em)+")");
    //set div scrolly style
    div.style("overflow-y","auto");
    d3.select("#markertoggle").style("visibility","hidden");
    d3.select("#locatortoggle").style("visibility","hidden");
}

function destroy_list(){
    //clean up the list svgs etc
    group.remove();
    header.style("visibility","hidden");
    header2.style("visibility","hidden");
    //header.selectAll("")
}

var listcomp = null;

function selectcompare(d,i,nodes){
    if (listcomp === null){
        listcomp = d;
    } else {
        listcomp = (listcomp[0]==d[0]) ? null : d;
    }
    redraw_list();
}

var hta = 0.041; //approx hta effect

//ranking functions here
// for wftda, score ratio expectation for P1's score against each P2 point is R1/(300S2-R1) where R1 is P1's ranking, and S2 is P2's SF.
function wftda_scores(d){
    var bottom = (median*listcomp[3]-d[3]); //cutoff for this being a pointless game
    if (bottom > 0) {
    // DerbyOnToast inversion to maintain ranking
    //    return (d[3]/(median*listcomp[3]-d[3])).toPrecision(3);
    // we now use the "predicted score ratio" by dividing the two score shares out (removes need for median)
        return (d[3]*d[3] / (listcomp[3]*listcomp[3])).toPrecision(3) ;
    }
    return (d[3]*d[3] / (listcomp[3]*listcomp[3])).toPrecision(3) + " RANK TOO HIGH" ; // based on the other mechanism for rearrangement
    //return "RANK TOO HIGH";
}

function srd_scores(d){
    var v = Math.exp(d[3]-listcomp[3]);
    var dv = Math.exp(parseFloat(d[4])+parseFloat(listcomp[4]))-1;
    return v.toPrecision(3) + "\u00b1" + (Math.abs(v*dv)/2).toPrecision(2) ;
}

function wftda_colours(d){
    if (d[0] == listcomp[0]) {
        return "#505";
    }
    if (+d[3] > +listcomp[3]) {
        return "#A00";
    } else {
        return "#00A";
    }
}

function srd_colours(d){
    var v = (+d[3]-listcomp[3]), dv = parseFloat(d[4])+parseFloat(listcomp[4]);
    if (Math.abs(v) > dv) { //no chance of upset
        if (v>0) {
            return "#A00";
        }
        return "#00A";
    } else { //interpolate colours
        var interp = v/dv;
        return "rgb("+65*(1+Math.round(interp))+",0,"+65*(1-Math.round(interp))+")";
    }
    return "#AA0";
}

function redraw_list() {
//need to add virtual scrolling of list?, probably based on http://www.billdwhite.com/wordpress/2014/05/17/d3-scalability-virtual-scrolling-for-large-visualizations/
// we need to refactor this when we do, into two functional sets:
//   "update filtered list" - triggered when any of our filter options change, updates filterr, sortedr
//       - this then triggers updatescroll to update the actual displayed portion (including doing the enter, exits etc on the svg)
//   "updatescroll"  - triggered on scroll, also on any other need to redraw the actual svg. Uses current filterr, sortedr
//       - possibly has a "sortedr has changed" flag to let it do the fancy transitions here when we're actually altering the underlying list
//   (other "views" of the data - like the map view - are added as alternative "updatescroll" level things, still using sortedr as feed)
var ckey = menu_vars.col;
//key'd data (key is the FTS id, field 0)
bb = div.node().getBoundingClientRect();
var width = bb.right - bb.left; // width for formatting later

var maxwidth = width - 62 - 22*em; ///text formatting
console.log(maxwidth);
function namegen(d){
    var str;

    if (d[11]=="Travel Team") {
            str = d[9] + " A" ;
    } else if (d[11]=="Exhibition Team") {
            str = d[9];
    } else {
        str =   d[9] + " of " + d[10] ;  //team index 1 is ratings splice index 9
    }
    //test length

    return str;
}

function squeezep(d){
    source = 0.7*em*namegen(d).length;
    if ( (source - maxwidth) > -2) {
        return maxwidth;
    } else {
        return source;
    }
}

var score_func, colour_func;
//functions for comparisons
if (r_key == "SRDRank" || r_key == "SRDRank2.1"){
    score_func = srd_scores;
    colour_func = srd_colours;
} else { //WFTDA
    score_func = wftda_scores;
    colour_func = wftda_colours;
}


if (listcomp===null) {
    group.attr("transform","translate(0,"+Math.round(2.3 *em)+")");
    header2.style("visibility","hidden");
} else {
    group.attr("transform","translate(0,"+Math.round(5.6 *em)+")");
    header2.style("visibility","visible");
    header2.attr("width",width);
    header2.style("top",bb.top+2.3*em);
    header2.select(".teamname").attr("x",width/2 -22).text(namegen(listcomp)).attr("textLength",squeezep(listcomp));
    header2.select(".wl").attr("x",width/2 -22);
    header2.select(".endnote").attr("x",width-50);
    header2.select('rect').attr('width',width-20);
}

svg.attr("height",Math.round((sortedr.length+2)*3.3*em)); //resize svg to the list length, I think
svg.attr("width", width);

var g = group.selectAll("g").data(sortedr,function(d){return d[0];});

//remove old nodes - probably should transition this
g.exit().transition("x").duration(500).remove();
//make these selectors more efficient by selecting on an id… so it's selectAll("an id")
g.exit().select("rect").transition("x").duration(499).attr("fill-opacity",0);
g.exit().select("text").transition("x").duration(499).attr("fill-opacity",0);
//g.exit().selectAll(".barcontent").transition().duration(749).attr("fill-opacity",0);

genter = g.enter().insert("g")
	.attr("transform",function(d, i) {return "translate(5,"+(Math.round(i * 3.3 *em)+5)+")"; })
	.on("click",selectcompare);

//add our rectangles as transparent to start with
grects = genter.append("rect")
    .attr("fill", function(d) { return scolmap.get(colmap[ckey](d));})
    .attr("class","barcontent")
    .attr("fill-opacity", 0).attr("stroke-opacity",0)
    .attr("stroke", function(d){ return (listcomp !== null) ? colour_func(d) : "#444";})
    .attr("stroke-width", function(d){ return (listcomp !== null) ? 3 : 1;})
    .attr("width",width - 10) //10 pix, 5 on each side
    .attr("height",'3em');

//text needs to be in columns, which is annoying (should have [RANK][GEN RANK]   ... [NAME] ...    [RATING p/m ERROR][ICONS])
//                                                            [ LEFT ALIGNED ]   [CENTER ALIGNED]  [      RIGHT ALIGNED    ]
//I think this means I need tspans again


//    //          max widths     4 chars     2   4       2       ?       4       ?       1      5        1       4       (~3 for FTS logo) = 30 total w/o ?
//    .text(linegen); //team index 1 is ratings splice index 9

    genter.append('text').attr("class","rank")
              .attr("x",5).attr("y","2em").text(function(d){ return d[8];});
    genter.append("text").attr("class","purerank")
              .attr('x',5+5*em).attr("y","2em").text(function(d) { return "("+d[7]+")";});
    genter.append("text").attr("class","teamname")
              .attr("x", (width/2) - 22).attr("y","2em").attr("text-anchor","middle").attr("textLength",squeezep) //textlength to try to fix longer names better
                        .text(namegen);  //text-anchor for centering, position is centre of column width:
                                                                                                // width - (10 marg) - 40(fts) - 5+11em (rank) - 11em (rating)
                                                                                                // = width - 55 - 22em (!), w/2 is width/2 - 27 - 11em
                                                                                                // offset = 5+11em, so total centre is width/2 - 22!
    if (listcomp === null) {
        genter.append("text").attr("class","rating")
            .attr("x", width-110).attr("y","2em").attr('text-anchor','end').text(function(d){ return d[3]+ "\u00b1" +d[4];}); //line width position to not overlap the FTS logo
    } else {
        genter.append("text").attr("class","rating")
            .attr("x", width-110).attr("y","2em").attr('text-anchor','end').text(score_func);
    }
//          .merge(txt)
//           .text(linegen);
//genter.append("text")
genter.append("a")
    .attr("xlink:href",function(d) {return "http://flattrackstats.com/teams/"+d[0]}).attr("target","_blank") //this seems to break due to some minification issue
    .append("image").attr("xlink:href","fts-logo-sm.png").attr("y","1em").attr("x",width - 65); //40 px width - 5pix border - 5px internal border - 5px for offset to left

header.attr("width",width);
header.style("top",bb.top);
header.select('rect').attr('width',width-20);
header.select(".rank").attr('x',5);
header.select(".purerank").attr("x",5+5*em);
header.select('.teamname').attr("x",width/2 - 22);
header.select('.rating').attr('x',width-110);

header.select('.rating').text("Rating");


//and transition them to full visibility
grects.transition("x").delay(500).duration(500).attr("fill-opacity",0.3).attr("stroke-opacity",1);
genter.selectAll("text").transition("x").delay(500).duration(500).attr("fill-opacity",1);

//update the ranking text for the new order
g.select("rect").attr("stroke", function(d){ return (listcomp !== null) ? colour_func(d) : "#444";})
    .attr("stroke-width", function(d){ return (listcomp !== null) ? 3 : 1;})
g.select(".rank").text(function(d){return d[8];}); //team index 1 is ratings splice index 9
g.select(".purerank").text(function(d) { return "("+d[7]+")";});
g.select('rect').attr('width',width-20);
g.select('.teamname').attr("x",width/2 - 22).attr("textLength",squeezep); //textlength to try to fix longer names better
if (listcomp === null) {
    g.select('.rating').attr("x", width-110).text(function(d){ return d[3]+ "\u00b1" +d[4];});
} else {
g.select('.rating').text(score_func);
}
g.select('image').attr("x",width - 65);

//transition the nodes to the new position
g.transition("x").duration(500).attr("transform",function(d, i) { return "translate(5,"+(Math.round(i * 3.3 *em)+5)+")"; });
//transition the nodes to the new colour scheme
g.select("rect").transition("x").duration(500).attr("fill", function(d) { return scolmap.get(colmap[ckey](d));});


};
