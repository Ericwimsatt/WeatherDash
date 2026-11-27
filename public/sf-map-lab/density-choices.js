window.DENSITY_CHOICES = {
  weather: [
    {id:'compact',title:'Compact bare text',note:'18 px high / low, 11 px second row. Keeps the map open while fitting more points.',tradeoff:'Smallest reading surface; best when the map is viewed close up.'},
    {id:'reference',title:'Original large text',note:'The previous 25 px high / low treatment, shown with the same 22 locations.',tradeoff:'Easiest to read, but dense clusters leave less breathing room.'},
    {id:'high-led',title:'High leads, low recedes',confirmed:true,note:'18 pt high with a 14 pt low. UV and rain stay in a quiet second row.',tradeoff:'A clear first number, but low temperatures take longer to compare.'},
    {id:'capsule',title:'Small paper capsule',note:'Compact two-row text in a lightly filled oval. Just enough backing to separate it from roads and hills.',tradeoff:'More readable over busy map features; uses more visual area.'},
    {id:'outline',title:'Fine outline',note:'A thin rounded frame groups the two rows without adding a solid fill.',tradeoff:'Less backing than a capsule, though the outline adds map ink.'},
    {id:'split',title:'Paired temperature lozenges',note:'A small red-tinted high and blue-tinted low, with UV / rain beneath on the map.',tradeoff:'Separates the readings quickly; introduces the most component styling.'},
  ],
  swimmer: [
    {id:'disc',title:'Paper disc',note:'A warm white circle and fine edge give the swimmer a consistent button silhouette.',tradeoff:'Clear against both water and land.'},
    {id:'bare',title:'Bare swimmer',note:'The selected competition freestyle glyph without a visible button surface.',tradeoff:'Quietest on the map, with the least obvious button affordance.'},
    {id:'filled',title:'Solid teal disc',confirmed:true,note:'A half-size white swimmer on a filled teal circle; the button stays the same size.',tradeoff:'Strongest action cue; competes more with weather readings.'},
    {id:'squircle',title:'Small rounded square',note:'A paper square with gently rounded corners and a teal edge.',tradeoff:'Reads as a control rather than a geographic point.'},
    {id:'ring',title:'Open teal ring',note:'An outlined circular button with the map visible through the middle.',tradeoff:'Keeps the shoreline visible, but has more competing linework.'},
  ],
};
