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
        public LineCurve sterncurve = null;

        public Stern(double length)
        {
            //PARAMETRIC Boat Length
            Point3d spoint = new Point3d(length, 0, 0);
            this.sterncurve = new LineCurve(KayakGeometry.origin, spoint);
        }

    }
}
