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
            Point3d spointB = new Point3d(length, 0, 0);
            Vector3d svector = spointB - spoint;


            Point3d epoint = new Point3d(length, 0, 0);
            Point3d epointB = new Point3d(-length, 0, height);
            Vector3d evector = epoint - epointB;

            double ratio = 1;

            sterncurve = Curve.CreateArcLineArcBlend(spoint, svector, epoint, evector, ratio);
            Curve[] sterncurves = sterncurve.DuplicateSegments();

            double endparam = 1;
            double startparam = 0;
            BlendContinuity tangency = BlendContinuity.Tangency;

            this.sterncurve = Curve.CreateBlendCurve(sterncurves[0], endparam, false, tangency, sterncurves[1], startparam, false, tangency);
        }

    }
}
