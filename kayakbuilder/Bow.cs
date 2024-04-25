using Rhino;
using Rhino.Commands;
using Rhino.Geometry;
using Rhino.Input;
using Rhino.Input.Custom;
using Rhino.Geometry.Collections;
using System;
using System.Collections.Generic;
using System.Diagnostics;

namespace kayakbuilder
{
    internal class Bow : KayakGeometry
    {
        //Class Instance Variables
        public string componenttype = "Bow";
        public Curve bowcurve = null;

        public Bow(double length, double height, double xcorner, double zcorner)
        {
            //PARAMETRIC Bow Length
            Point3d spoint = new Point3d(0, 0, 0);
            Vector3d svector = new Vector3d(length, 0, 0);

            //PARAMETRIC Bow Height
            Point3d epoint = new Point3d(length, 0, height);
            Point3d epointB = new Point3d(length, 0, -height);
            Vector3d evector = epoint - epointB;

            List<Point3d> points = new List<Point3d>();
            points.Add(spoint);
            points.Add(epoint);

            NurbsCurve bow = Curve.CreateInterpolatedCurve(points, 3, CurveKnotStyle.ChordSquareRoot, svector, evector).ToNurbsCurve();
            NurbsCurvePointList bowpnts = bow.Points;
            RhinoApp.WriteLine(bowpnts.Count.ToString());

            //PARAMETRIC Control Point Location
            Point3d hcpoint = new Point3d(xcorner, 0, 0);
            bowpnts.SetPoint(1, hcpoint, 1);
            Point3d vcpoint = new Point3d(length, 0, -zcorner);
            bowpnts.SetPoint(2, vcpoint, 1);

            this.bowcurve = bow;

        }
    }

}
