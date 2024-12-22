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

        public Gunwale(double sternwidth, double beam, double bowwidth, double splace, double xplace, double bplace, double height, Rhino.Geometry.Point3d sternpnt, Rhino.Geometry.Point3d bowpnt)
        {
            //TODO Add Weight Parameters as well for contorl points

            //Handling X distances
            if (xplace < 0)
            {
                xplace = 0;
            }
            if (splace >= xplace)
            {
                splace = xplace / 2;
            }
            if (bplace <= xplace)
            {
                bplace = xplace + xplace / 2;
            }

            //PARAMETRIC Bow Length
            Vector3d svector = new Vector3d(splace, -sternwidth / 2, 0);

            //PARAMETRIC Stern Width
            Point3d spoint = new Point3d(splace, -sternwidth / 2, height);

            //PARAMETRIC Beam Width
            Point3d mpoint = new Point3d(xplace, -beam / 2, height);

            //PARAMETRIC Ster
            Point3d bpoint = new Point3d(bplace, -bowwidth / 2, height);

            //PARAMETRIC Bow Height
            Vector3d evector = bowpnt - bpoint;

            List<Point3d> points = new List<Point3d>();
            points.Add(sternpnt);
            points.Add(spoint);
            points.Add(mpoint);
            points.Add(bpoint);
            points.Add(bowpnt);

            NurbsCurve gunwale = Curve.CreateInterpolatedCurve(points, 3, CurveKnotStyle.ChordSquareRoot, svector, evector).ToNurbsCurve();
            NurbsCurvePointList gunwalepnts = gunwale.Points;
            RhinoApp.WriteLine(gunwalepnts.Count.ToString());

            this.gunwalecurve = gunwale;
        }   
    }
}
