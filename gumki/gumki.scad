// Pojemnik na gumki do włosów – kubki do układania jeden na drugim + dekiel (OpenSCAD)
// Góra kubka: niski kołnierz. Spód kubka i dekla: wgłębienie, w które wchodzi kołnierz.
// part = "kubek" | "dekiel" | "2_kubki" | "zlozone"
part = "zlozone";

H=120; R_IN=37; WALL=2.8; FLOOR=2.4;
N_RIBS=40; RIB_R=1.6;
WIN_W=54; WIN_Z0=16; WIN_RAD=8;
COL_IN=1.0; COL_T=1.8; COL_H=4.0; FIT=0.25; LID_TOP=2.4;
TEXT_ON=false; TEXT="Maya"; FONT="Pacifico";   // opcjonalny napis nad okienkiem
TEXT_SIZE=15; TEXT_Z=H-21; TEXT_UP=1.2; BAND_W=70; BAND_H=31;
$fn=128;

R_OUT=R_IN+WALL; R_RIB=R_OUT+RIB_R;
COL_R0=R_IN-COL_IN; COL_R1=COL_R0+COL_T;
REC_R=COL_R1+FIT; REC_H=COL_H+0.3; BASE=REC_H+FLOOR;
WIN_Z1= TEXT_ON ? H-36 : H-12;
LID_H=REC_H+LID_TOP;

module ribs(h) for (i=[0:N_RIBS-1]) rotate(360*(i+0.37)/N_RIBS) translate([R_OUT,0,0]) cylinder(h=h, r=RIB_R, $fn=24);

module kubek() {
  difference() {
    union() {
      rotate_extrude() polygon([[0,REC_H],[REC_R,REC_H],[REC_R,0.6],[REC_R+0.6,0],[R_OUT,0],[R_OUT,H],
        [COL_R1,H],[COL_R1,H+COL_H],[COL_R0,H+COL_H],[COL_R0,H],[R_IN,H-COL_IN],[R_IN,BASE],[0,BASE]]);
      difference() { ribs(H); translate([0,0,-1]) cylinder(h=H+2, r=R_OUT-0.01); }
    }
    translate([0,0,(WIN_Z0+WIN_Z1)/2]) rotate([90,0,0])
      linear_extrude(R_OUT+5) offset(r=WIN_RAD) square([WIN_W-2*WIN_RAD, WIN_Z1-WIN_Z0-2*WIN_RAD], center=true);
  }
  if (TEXT_ON && TEXT!="") {
    intersection() {
      difference() { cylinder(h=H, r=R_RIB); translate([0,0,-1]) cylinder(h=H+2, r=R_IN+0.5); }
      translate([-BAND_W/2,-R_RIB-5,TEXT_Z+2-BAND_H/2]) cube([BAND_W,R_RIB+5,BAND_H]);
    }
    intersection() {
      difference() { cylinder(h=H, r=R_RIB+TEXT_UP); translate([0,0,-1]) cylinder(h=H+2, r=R_OUT); }
      translate([0,0,TEXT_Z]) rotate([90,0,0]) linear_extrude(R_RIB+TEXT_UP+1)
        text(TEXT, size=TEXT_SIZE, font=FONT, halign="center", valign="baseline");
    }
  }
}

// dekiel – drukować tak jak jest (wierzchem do stołu, wgłębieniem do góry)
module dekiel() difference() {
  union() { cylinder(h=LID_H, r=R_OUT); ribs(LID_H); }
  translate([0,0,LID_TOP]) cylinder(h=LID_H, r=REC_R);
  translate([0,0,LID_H-0.6]) cylinder(h=0.61, r1=REC_R, r2=REC_R+0.6);
}

if (part=="kubek") kubek();
if (part=="dekiel") dekiel();
if (part=="2_kubki") { kubek(); translate([2*R_RIB+8,0,0]) kubek(); }
if (part=="zlozone") { kubek(); translate([0,0,H]) kubek(); translate([0,0,2*H+LID_H]) mirror([0,0,1]) dekiel(); }
