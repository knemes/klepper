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
    internal class Stern : KayakGeometry
    {
        //Class Instance Variables
        public string componenttype = "Stern";
        public Curve sterncurve = null;

        public Stern(double length, double height, double weight)
        {
            //PARAMETRIC Stern Height
            Point3d spoint = new Point3d(0, 0, height);
            Point3d spointB = new Point3d(0, 0, -height);
            Vector3d svector = spointB - spoint;

            //PARAMETRIC Stern Length
            Point3d epoint = new Point3d(length, 0, 0);
            Point3d epointB = new Point3d(-length, 0,0);
            Vector3d evector = epoint - epointB;

            List<Point3d> points = new List<Point3d>();
            points.Add(spoint);
            //points.Add(Plane.WorldXY.Origin);
            points.Add(epoint);

            NurbsCurve stern = Curve.CreateInterpolatedCurve(points, 3, CurveKnotStyle.ChordSquareRoot, svector, evector).ToNurbsCurve();
            NurbsCurvePointList sternpnts = stern.Points;
            RhinoApp.WriteLine(sternpnts.Count.ToString());

            //PARAMETRIC Control Point Weight
            sternpnts.SetWeight(1, weight);
            sternpnts.SetWeight(2, weight);
            this.sterncurve = stern;

        }

    }
}
