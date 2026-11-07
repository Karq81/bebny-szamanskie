// Pojemnik na gumki do włosów – korpus z okienkiem + pokrywka (OpenSCAD)
// part = "korpus" | "pokrywka" | "oba"
part = "oba";
H=120; R_IN=37; WALL=2.4; BOTTOM=2.4;
N_RIBS=40; RIB_R=1.6;
TEXT_ON=false;          // true = pole z napisem nad okienkiem (ustaw też TEXT)
WIN_W=54; WIN_Z0=14; WIN_Z1= TEXT_ON ? H-36 : H-14; WIN_RAD=8;
TEXT="";                // napis na froncie, np. "Maya" ("" = bez napisu)
FONT="Pacifico";        // zainstaluj Pacifico.ttf (jest w tym folderze)
TEXT_SIZE=15; TEXT_Z=H-21; TEXT_UP=1.2; BAND_W=70; BAND_H=31;
CLEAR=0.3; LID_T=3; LIP_H=6;
R_OUT=R_IN+WALL; $fn=96;

module korpus() difference() {
  union() {
    cylinder(h=H, r=R_OUT);
    for (i=[0:N_RIBS-1]) rotate(360*i/N_RIBS) translate([R_OUT,0,0]) cylinder(h=H, r=RIB_R, $fn=24);
  }
  translate([0,0,BOTTOM]) cylinder(h=H, r=R_IN);
  // okienko z przodu
  translate([0,0,(WIN_Z0+WIN_Z1)/2]) rotate([90,0,0])
    linear_extrude(R_OUT+5) offset(r=WIN_RAD) square([WIN_W-2*WIN_RAD, WIN_Z1-WIN_Z0-2*WIN_RAD], center=true);
}
module napis() if (TEXT_ON && TEXT!="") {
  R_T=R_OUT+RIB_R;
  // gładkie pole pod napisem
  intersection() {
    difference() { cylinder(h=H, r=R_T); translate([0,0,-1]) cylinder(h=H+2, r=R_IN+0.5); }
    translate([-BAND_W/2,-R_T-5,TEXT_Z+2-BAND_H/2]) cube([BAND_W,R_T+5,BAND_H]);
  }
  // wypukły napis
  intersection() {
    difference() { cylinder(h=H, r=R_T+TEXT_UP); translate([0,0,-1]) cylinder(h=H+2, r=R_OUT); }
    translate([0,0,TEXT_Z]) rotate([90,0,0]) linear_extrude(R_T+TEXT_UP+1)
      text(TEXT, size=TEXT_SIZE, font=FONT, halign="center", valign="baseline");
  }
}
module pokrywka() {
  cylinder(h=LID_T, r=R_OUT+RIB_R);
  translate([0,0,LID_T]) difference() {
    cylinder(h=LIP_H, r=R_IN-CLEAR);
    cylinder(h=LIP_H+1, r=R_IN-CLEAR-1.8);
  }
}
if (part=="korpus" || part=="oba") { korpus(); napis(); }
if (part=="pokrywka" || part=="oba") translate([2*R_OUT+15,0,0]) pokrywka();
