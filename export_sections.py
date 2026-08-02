import Rhino
import scriptcontext as sc
import json
import os

def export_sections():
    # Ask user to select objects to slice (Breps or Meshes)
    go = Rhino.Input.Custom.GetObject()
    go.SetCommandPrompt("Select kayak surfaces, Breps, or Meshes to slice")
    go.GeometryFilter = Rhino.DocObjects.ObjectType.Brep | Rhino.DocObjects.ObjectType.Mesh
    go.Get()
    if go.CommandResult() != Rhino.Commands.Result.Success:
        print("Selection canceled.")
        return
        
    objects = [go.Object(i).Geometry() for i in range(go.ObjectCount)]
    
    # Get bounding box of all objects to determine length and start/end X
    bbox = Rhino.Geometry.BoundingBox.Empty
    for obj in objects:
        bbox.Union(obj.GetBoundingBox(True))
        
    min_x = bbox.Min.X
    max_x = bbox.Max.X
    
    # Align the coordinate system so that the stern (min_x) starts at X = 0
    shift_x = min_x
    
    spacing = 12.0 # Slice every 12 inches (1 foot)
    tolerance = sc.doc.ModelAbsoluteTolerance
    
    sections_data = []
    
    x = min_x
    while x <= max_x + 0.01:
        plane = Rhino.Geometry.Plane(Rhino.Geometry.Point3d(x, 0, 0), Rhino.Geometry.Vector3d.XAxis)
        section_points = []
        
        for obj in objects:
            curves = []
            if isinstance(obj, Rhino.Geometry.Brep):
                rc, crvs, pnts = Rhino.Geometry.Intersect.Intersection.BrepPlane(obj, plane, tolerance)
                if rc:
                    curves.extend(crvs)
            elif isinstance(obj, Rhino.Geometry.Mesh):
                crvs = Rhino.Geometry.Intersect.Intersection.MeshPlane(obj, plane)
                if crvs:
                    curves.extend(crvs)
                    
            for crv in curves:
                # Sample 30 points along each intersection curve for smooth fidelity
                t_params = crv.DivideByCount(30, True)
                if t_params:
                    for t in t_params:
                        pt = crv.PointAt(t)
                        section_points.append({
                            "y": round(pt.Y, 4),
                            "z": round(pt.Z, 4)
                        })
                        
        if section_points:
            # Sort points by Y coordinate so they are clean to visualize or parse
            section_points.sort(key=lambda p: p["y"])
            sections_data.append({
                "x": round(x - shift_x, 2),
                "points": section_points
            })
            
        x += spacing
        
    # Prompt the user to save the file
    fd = Rhino.UI.SaveFileDialog()
    fd.Filter = "JSON files (*.json)|*.json"
    fd.Title = "Save Kayak Sections JSON"
    fd.DefaultExt = "json"
    fd.FileName = "kayak_sections.json"
    if fd.ShowSaveDialog():
        filepath = fd.FileName
        with open(filepath, "w") as f:
            json.dump({"sections": sections_data}, f, indent=2)
        print("Successfully exported {} sections to: {}".format(len(sections_data), filepath))

if __name__ == "__main__":
    export_sections()
