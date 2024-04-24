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

        public Bow(double length, double height, double longweight, double vertweight)
        {
            //PARAMETRIC Bow Length
            Point3d spoint = new Point3d(length, 0, 0);
            Point3d spointB = new Point3d(-length, 0, 0);
            Vector3d svector = spoint - spointB;

            //PARAMETRIC Bow Height
            Point3d epoint = new Point3d(0, 0, height);
            Point3d epointB = new Point3d(0, 0, -height);
            Vector3d evector = epointB - epoint;

            List<Point3d> points = new List<Point3d>();
            points.Add(spoint);
            //points.Add(Plane.WorldXY.Origin);
            points.Add(epoint);

            NurbsCurve bow = Curve.CreateInterpolatedCurve(points, 3, CurveKnotStyle.ChordSquareRoot, svector, evector).ToNurbsCurve();
            NurbsCurvePointList bowpnts = bow.Points;
            RhinoApp.WriteLine(bowpnts.Count.ToString());

            //PARAMETRIC Control Point Weight
            bowpnts.SetWeight(1, longweight);
            bowpnts.SetWeight(2, vertweight);
            this.bowcurve = bow;

        }
    }

}
