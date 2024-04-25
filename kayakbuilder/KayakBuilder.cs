using Rhino;
using Rhino.Commands;
using Rhino.Geometry;
using Rhino.Input;
using Rhino.Input.Custom;
using System;
using System.Collections.Generic;

namespace kayakbuilder
{
    public class KayakBuilder : Command
    {
        public KayakBuilder()
        {
            // Rhino only creates one instance of each command class defined in a
            // plug-in, so it is safe to store a refence in a static property.
            Instance = this;
        }

        ///<summary>The only instance of this command.</summary>
        public static KayakBuilder Instance { get; private set; }

        ///<returns>The command name as it appears on the Rhino command line.</returns>
        public override string EnglishName => "KayakBuilder";

        protected override Result RunCommand(RhinoDoc doc, RunMode mode)
        {
            RhinoDoc.ActiveDoc.AdjustModelUnitSystem(UnitSystem.Inches, true);

            int klength = 16 * 12;
            double slength = 6;
            double blength = 12;

            //PARAMETRIC Boat Length
            Point3d origin = new Point3d(0, 0, 0);
            Point3d kpoint = new Point3d(klength, 0, 0);
            LineCurve centerline = new LineCurve(origin, kpoint);

            Stern stern = new Stern(slength, 9, 1);

            Bow bow = new Bow(blength, 9, .1, 1);
            Vector3d bowtranslate = new Vector3d(klength - blength, 0, 0);
            bow.bowcurve.Translate(bowtranslate);

            doc.Objects.AddCurve(centerline);
            doc.Objects.AddCurve(stern.sterncurve);
            doc.Objects.AddCurve(bow.bowcurve);

            //doc.Objects.AddLine(origin, kpoint);
            doc.Views.Redraw();
            RhinoApp.WriteLine("The {0} command added one line to the document.", EnglishName);

            // ---
            return Result.Success;
        }
    }
}
