using Rhino;
using Rhino.Commands;
using Rhino.Geometry;
using Rhino.Input;
using Rhino.Input.Custom;
using System;
using System.Collections.Generic;


namespace kayakbuilder
{
    internal class Stern : KayakGeometry
    {
        //Class Instance Variables
        public string componenttype = "Stern";
        public Curve sterncurve = null;

        public Stern(double length, double height)
        {
            //PARAMETRIC Boat Length
            Point3d spoint = new Point3d(0, 0, height);
            Point3d spointB = new Point3d(0, 0, -height);
            Vector3d svector = spointB - spoint;


            Point3d epoint = new Point3d(length, 0, 0);
            Point3d epointB = new Point3d(-length, 0,0);
            Vector3d evector = epoint - epointB;

            double ratio = 1;

            List<Point3d> points = new List<Point3d>();
            points.Add(spoint);
            points.Add(epoint);

            this.sterncurve = Curve.CreateInterpolatedCurve(points, 3, CurveKnotStyle.UniformPeriodic, svector, evector);
        }

    }
}
