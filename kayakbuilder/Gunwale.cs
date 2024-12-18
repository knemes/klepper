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
    internal class Gunwale : KayakGeometry
    {
        //Class Instance Variables
        public string componenttype = "Gunwale";
        public Curve gunwalecurve = null;

        public Gunwale(double beam, double xplace, double height, Rhino.Geometry.Point3d sternpnt, Rhino.Geometry.Point3d bowpnt)
        {
            Point3d spoint = new Point3d(0, 0, 0);
        }
    }
}
