// Pojemnik na gumki do włosów – korpus z okienkiem + pokrywka (OpenSCAD)
// part = "korpus" | "pokrywka" | "oba"
part = "oba";
H=120; R_IN=37; WALL=2.4; BOTTOM=2.4;
N_RIBS=40; RIB_R=1.6;
WIN_W=54; WIN_Z0=14; WIN_Z1=H-14; WIN_RAD=8;
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
module pokrywka() {
  cylinder(h=LID_T, r=R_OUT+RIB_R);
  translate([0,0,LID_T]) difference() {
    cylinder(h=LIP_H, r=R_IN-CLEAR);
    cylinder(h=LIP_H+1, r=R_IN-CLEAR-1.8);
  }
}
if (part=="korpus" || part=="oba") korpus();
if (part=="pokrywka" || part=="oba") translate([2*R_OUT+15,0,0]) pokrywka();
