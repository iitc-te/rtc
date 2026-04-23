
// Global site coordinates

var server_data = {};

var MARKER_RADIUS_PX = 12;

var currentLat = null,
    currentLon = null;

var progressbar = {

    // Reset to initial idle state

    init: function () {

        jQuery("#offcanvas")
            .find(".progress-bar")
            .css("width", "0%")
            .attr("aria-valuenow", 0)
            .removeClass("progress-bar-striped progress-bar-animated");

    },

    // Show running / busy state

    busy: function () {

        jQuery("#offcanvas")
            .find(".progress-bar")
            .css("width", "100%")
            .attr("aria-valuenow", 100)
            .addClass("progress-bar-striped progress-bar-animated");

    }

};

var msgbox = {

    hide: function () {

        jQuery("#msgbox").modal("hide");

    },

    show: function (html) {

        if (typeof html === "undefined") {
            html = "";
        }

        jQuery("#msgbox").modal("show");
        jQuery("#msgbox").find(".msgboxContent").html(html);

    },

    show_html: function (ic, tx) {

        var html = "";

        html += "<div class='text-center'>";
        html += "<i class='bi " + ic + "'></i> ";
        html += "&nbsp; ";
        html += tx;
        html += "</div>";

        this.show(html);

    },

    success: function (tx) {

        this.show_html("bi-check2-circle", tx);

    },

    failure: function (tx) {

        this.show_html("bi-x-circle", tx);

    },

    info: function (tx) {

        this.show_html("bi-info-circle", tx);

    }

};

var areaChart = {

    chart: null,
    baseOptions: null,

    init: function () {

        google.charts.load("current", { packages: ["corechart"] });

        google.charts.setOnLoadCallback(() => {

            this.chart = new google.visualization.ComboChart(
                document.getElementById("chart-container")
            );

            // Base options (series + colors injected dynamically)

            this.baseOptions = {

                isStacked: true,
                areaOpacity: 0.85,
                // curveType: "function",

                backgroundColor: {
                    fill: "transparent"
                },

                tooltip: {
                    textStyle: {
                        fontName: "Titillium Web",
                        fontSize: 12,
                        bold: false,
                        italic: false
                    }
                },

                legend: {
                    position: "top",
                    alignment: "center",
                    textStyle: {
                        fontName: "Titillium Web",
                        fontSize: 12,
                        bold: false,
                        italic: false
                    }
                },

                hAxis: {
                    title: "Hour of the Year",
                    format: "0",
                    gridlines: { count: 24 },
                    minorGridlines: { count: 0 },
                    textStyle: {
                        fontName: "Titillium Web",
                        fontSize: 12,
                        bold: false,
                        italic: false
                    },
                    titleTextStyle: {
                        fontName: "Titillium Web",
                        fontSize: 12,
                        bold: false,
                        italic: false
                    }
                },

                vAxis: {
                    title: "MWh",
                    baseline: 0,
                    gridlines: { color: "#E0E0E0" },
                    textStyle: {
                        fontName: "Titillium Web",
                        fontSize: 12,
                        bold: false,
                        italic: false
                    },
                    titleTextStyle: {
                        fontName: "Titillium Web",
                        fontSize: 12,
                        bold: false,
                        italic: false
                    }
                },

                chartArea: {
                    left: 70,
                    right: 20,
                    top: 50,
                    bottom: 60,
                    width: "100%",
                    height: "100%"
                }

            };

        });

    },

    clear: function () {

        if (!this.chart) return;

        var emptyTable = google.visualization.arrayToDataTable([
            ["Hour", "Power"],
            [0, 0]
        ]);

        this.chart.draw(emptyTable, this.baseOptions);

        // jQuery("#chart-container").addClass("hddn");

    },

    plot: function (uc, vmin, vmax) {

        if (!this.chart || !uc) return;

        var n = uc.hour.length;

        // --- Define candidate series (order matters) ---

        var candidates = [

            {
                key: "solr",
                label: "Solar",
                values: uc.solr.map(v => v || 0),
                type: "area",
                color: "#F2BE4A"
            },

            {
                key: "wind",
                label: "Wind",
                values: uc.wind.map(v => v || 0),
                type: "area",
                color: "#4E79A7"
            },

            {
                key: "bess_dis",
                label: "BESS Discharge",
                values: uc.bess.map(v => Math.max(v || 0, 0)),
                type: "area",
                color: "#59A14F"
            },

            {
                key: "nspo",
                label: "Non-Supplied Power",
                values: uc.nspo.map(v => v || 0),
                type: "area",
                color: "#E15759"
            },

            {
                key: "curt",
                label: "Curtailment",
                values: uc.curt.map(v => v || 0),
                type: "area",
                color: "#E0E0E0"
            },

            {
                key: "bess_chg",
                label: "BESS Charge",
                values: uc.bess.map(v => Math.min(v || 0, 0)),
                type: "line",
                color: "#2E7D32",
                lineWidth: 2
            }

        ];

        // --- Keep only non-zero series ---

        var active = candidates.filter(s =>
            s.values.some(v => Math.abs(v) > 1e-9)
        );

        // Fallback if everything is zero
        if (active.length === 0) {
            this.clear();
            return;
        }

        // --- Build DataTable ---

        var header = ["Hour"].concat(active.map(s => s.label));
        var table = [header];

        for (var i = 0; i < n; i++) {

            var row = [uc.hour[i]];

            for (var j = 0; j < active.length; j++) {
                row.push(active[j].values[i]);
            }

            table.push(row);

        }

        var dataTable = google.visualization.arrayToDataTable(table);

        // --- Build dynamic options ---

        var options = Object.assign({}, this.baseOptions);

        options.series = {};
        options.colors = [];

        active.forEach((s, idx) => {

            options.series[idx] = {
                type: s.type,
                lineWidth: s.lineWidth || undefined
            };

            options.colors.push(s.color);

        });

        // jQuery("#chart-container").removeClass("hddn");

        options.vAxis.viewWindow = {
            min: vmin,
            max: vmax
        };

        this.chart.draw(dataTable, options);

    }

};

google.charts.setOnLoadCallback(function () {

    areaChart.init();

    jQuery(document).ready(function () {

        // Map container and size

        var container = d3.select("#map-container"),
            width = window.innerWidth,
            height = window.innerHeight;

        // Create SVG

        var svg = container.append("svg")

            .attr("width", width)

            .attr("height", height)

            .attr("viewBox", [0, 0, width, height]);

        // Group for zoomable content

        var g = svg.append("g");

        // Map projection

        var projection = d3.geoMercator()

            .scale(width / 2 / Math.PI)

            .translate([width / 2, height / 1.5]);

        // Geo path generator

        var path = d3.geoPath().projection(projection);

        // Zoom behaviour

        var zoom = d3.zoom()

            .scaleExtent([1, 8])

            .on("zoom", function (event) {

                g.attr("transform", event.transform);

                g.selectAll(".marker").attr("r", MARKER_RADIUS_PX / event.transform.k);

                g.selectAll(".country").attr("stroke-width", 0.5 / event.transform.k);

            });

        svg.call(zoom);

        // Load and draw world map

        d3.json("3p/topojson-client/3.1.0/countries-50m.json")

            .then(function (world) {

                var countries = topojson.feature(world, world.objects.countries);

                g.selectAll("path")

                    .data(countries.features)

                    .enter()

                    .append("path")

                    .attr("class", "country")

                    .attr("d", path)

                    .attr("id", function (d) {

                        return "country-" + d.id;

                    });


            })

            .catch(function (err) {

                console.error("Error loading map data:", err);

            });

        // Click map to place marker and open form

        svg.on("click", function (event) {

            // Ignore marker clicks

            if (event.target.classList.contains("marker")) return;

            var transform = d3.zoomTransform(svg.node()),
                point = d3.pointer(event, svg.node());

            // Undo zoom transform

            var rawX = (point[0] - transform.x) / transform.k,
                rawY = (point[1] - transform.y) / transform.k;

            // Convert to lon/lat

            var coords = projection.invert([rawX, rawY]);

            if (!coords) return;

            var lon = coords[0],
                lat = coords[1];

            placeMarker(rawX, rawY, transform.k);

            // Delay for visual feedback

            setTimeout(function () {
                showOffcanvas(lat, lon);
            }, 1000);

        });

        // Draw marker at selected location

        function placeMarker(x, y, scale) {

            g.selectAll(".marker").remove();

            g.append("circle")

                .attr("cx", x)

                .attr("cy", y)

                .attr("r", MARKER_RADIUS_PX / scale)

                .attr("class", "marker");

        }

        // Offcanvas instance

        var canvas = new bootstrap.Offcanvas("#offcanvas");

        // Show offcanvas and store coordinates

        function showOffcanvas(lat, lon) {

            currentLat = lat;
            currentLon = lon;

            // Reset form and UI state

            jQuery("#offcanvas_form")[0].reset();

            jQuery("#offcanvas")

                .find(".is-invalid, .is-valid")

                .removeClass("is-invalid is-valid")

                .removeAttr("aria-invalid");

            progressbar.init();

            jQuery("#offcanvas").find(".result").empty();

            // Update title

            jQuery("#offcanvas .offcanvas-title").html(

                "<i class='bi bi-geo-alt'></i> &nbsp; " + lat.toFixed(3) + " , " + lon.toFixed(3)

            );

            restoreApiKey("ninj");

            restoreApiKey("ieso");

            jQuery("#offcanvas").find(".repr_week").data("plot", "");
            jQuery("#offcanvas").find(".repr_week").data("vmin", "");
            jQuery("#offcanvas").find(".repr_week").data("vmax", "");

            areaChart.clear();

            jQuery("#offcanvas").find(".scrollable").scrollTop(0);

            canvas.show();

        }

        // Remove marker when panel closes

        jQuery("#offcanvas").on("hidden.bs.offcanvas", function () {

            setTimeout(function () {
                g.selectAll(".marker").remove();
            }, 1000);

        });

        // Resize SVG on window resize

        window.addEventListener("resize", function () {

            container.select("svg")

                .attr("width", window.innerWidth)

                .attr("height", window.innerHeight);

        });

        // Save API key to localStorage

        function saveApiKey(id) {

            var v = jQuery("#" + id).val().trim();

            if (v !== "") {

                localStorage.setItem(id, v);

            }

        }

        // Restore API key from localStorage

        function restoreApiKey(id) {

            var v = localStorage.getItem(id);

            if (v !== null) {

                jQuery("#" + id).val(v);

            }

        }

        // Validate form inputs

        window.valid_form = function () {

            var isValid = true;

            jQuery("#offcanvas_form input[data-expected]").each(function () {

                var $input = jQuery(this),
                    raw = $input.val().trim(),
                    type = $input.data("expected"),
                    fieldValid = true;

                $input.removeClass("is-invalid is-valid");

                if (type === "text") {

                    if (raw === "") fieldValid = false;

                } else {

                    var value = Number(raw),
                        min = $input.data("mini"),
                        max = $input.data("maxi");

                    if (raw === "" || Number.isNaN(value)) {

                        fieldValid = false

                    };

                    if (fieldValid && type === "integer" && !Number.isInteger(value)) {

                        fieldValid = false

                    };

                    if (fieldValid && Number.isFinite(min) && value < min) {

                        fieldValid = false

                    };

                    if (fieldValid && Number.isFinite(max) && value > max) {

                        fieldValid = false

                    };

                }

                if (!fieldValid) {

                    $input.addClass("is-invalid");

                    isValid = false;

                } else {

                    $input.addClass("is-valid");

                }

            });

            return isValid;

        };

        // Clear validation state on input

        jQuery("#offcanvas_form").on("input", "input", function () {

            jQuery(this).removeClass("is-invalid is-valid");

        });

        // Helpers for values

        function num(id) {

            return Number(jQuery("#" + id).val());

        }

        function bool(id) {

            return jQuery("#" + id).is(":checked") ? 1 : 0;

        }

        function txt(id) {

            return jQuery("#" + id).val().trim();

        }

        function fmt(v, d) {

            return (typeof v === "number") ? v.toFixed(d) : "";

        }

        // Run simulation

        function data_toUI(payload, data) {

            if (!data) return;

            // Numeric fields

            jQuery("#offcanvas").find(".demand").html(fmt(data.demand, 0));

            jQuery("#offcanvas").find(".firm_solr").html(fmt(data.firm_solr, 2));
            jQuery("#offcanvas").find(".firm_wind").html(fmt(data.firm_wind, 2));
            jQuery("#offcanvas").find(".firm_bess").html(fmt(data.firm_bess, 2));

            jQuery("#offcanvas").find(".cost").html(fmt(data.cost, 2));
            jQuery("#offcanvas").find(".cost_lcoe").html(fmt(data.cost_lcoe, 2));
            jQuery("#offcanvas").find(".cost_firm").html(fmt(data.cost_firm, 2));

            jQuery("#offcanvas").find(".cost_firm_solr").html(fmt(data.cost_firm_solr, 2));
            jQuery("#offcanvas").find(".cost_firm_wind").html(fmt(data.cost_firm_wind, 2));
            jQuery("#offcanvas").find(".cost_firm_bess").html(fmt(data.cost_firm_bess, 2));

            // Update area chart

            var vmax = data.inst_solr + data.firm_solr + data.inst_wind + data.firm_wind,
                vmin = - vmax;

            areaChart.plot(data.unit_commitment.uc_4380, vmin, vmax);

            jQuery(".uc_0").data({
                plot: data.unit_commitment.uc_0,
                vmin: vmin,
                vmax: vmax
            });

            jQuery(".uc_2190").data({
                plot: data.unit_commitment.uc_2190,
                vmin: vmin,
                vmax: vmax
            });

            jQuery(".uc_4380").data({
                plot: data.unit_commitment.uc_4380,
                vmin: vmin,
                vmax: vmax
            });

            jQuery(".uc_6570").data({
                plot: data.unit_commitment.uc_6570,
                vmin: vmin,
                vmax: vmax
            });

        }

        jQuery("#simulate").on("click", function () {

            if (!valid_form()) {

                var $err = jQuery(".is-invalid").first();

                if ($err.length) {

                    $err[0].scrollIntoView({ behavior: "smooth", block: "center" });

                }

                return;

            }

            saveApiKey("ninj");

            saveApiKey("ieso");

            var payload = {
                apik: {
                    ieso: txt("ieso"),
                    ninj: txt("ninj")
                },
                site: {
                    lolat: currentLat,
                    lolon: currentLon,
                    cDura: num("cDura"),
                    oDura: num("oDura"),
                    kCost: num("kCost"),
                    rTarg: num("rTarg")
                },
                solr: {
                    iCapa: num("iCapa_solr"),
                    cCost: num("cCost_solr"),
                    oCost_t_cCost: num("oCost_t_cCost_solr"),
                    fOpts: bool("fOpts_solr")
                },
                wind: {
                    iCapa: num("iCapa_wind"),
                    cCost: num("cCost_wind"),
                    oCost_t_cCost: num("oCost_t_cCost_wind"),
                    fOpts: bool("fOpts_wind")
                },
                bess: {
                    iCapa: num("iCapa_bess"),
                    hStrg: num("hStrg_bess"),
                    rtEff: num("rtEff_bess"),
                    shBOS: num("shBOS_bess"),
                    cCost: num("cCost_bess"),
                    oCost_t_cCost: num("oCost_t_cCost_bess"),
                    fOpts: bool("fOpts_bess")
                }
            };

            progressbar.busy();

            jQuery.ajax({

                url: "https://responsive.li/api/rtc/",

                method: "POST",

                data: JSON.stringify(payload),

                contentType: "application/json",

                dataType: "json",

                timeout: 900000,

                // Handle application-level response

                success: function (response) {

                    // Validate response shape

                    if (!response || typeof response.rs === "undefined") {

                        msgbox.failure("Invalid server response");
                        return;

                    }

                    // Success path

                    if (response.rs === 1) {

                        /* response.data:
    
                        {
                            "inst_solr": ...,
                            "firm_solr": ...,
                            "inst_wind": ...,
                            "firm_wind": ...,
                            "firm_disp": ...,
                            "inst_bess": ...,
                            "firm_bess": ...,
                            "generation": ...,
                            "cost": ...,
                            "cost_lcoe": ...,
                            "cost_firm": ...,
                            "cost_firm_solr": ...,
                            "cost_firm_wind": ...,
                            "cost_firm_bess": ...,
                            "reliability": ...,
                            "unit_commitment": {
                                "uc_4380": {
                                    "hour": [1, 2, 3, ...],
                                    "solr": [1, 2, 3, ...],
                                    "wind": [1, 2, 3, ...],
                                    "curt": [1, 2, 3, ...],
                                    "bess": [-1, +2, -3, ...],
                                    "nspo": [1, 2, 3, ...]
                                }
                            }
                        }
    
                        */

                        server_data = response.data;

                        data_toUI(payload, response.data);

                        msgbox.success("Simulation completed successfully");

                        console.log(response.tx);

                    }

                    // Failure path (application error)

                    else {

                        msgbox.failure("Simulation failed");

                        console.log(response.tx);

                    }

                },

                // Handle transport/network errors

                error: function (xhr, status, error) {

                    var tx = "Request failed. Are you connected?";

                    // Try to extract server JSON message

                    if (xhr && xhr.responseText) {
                        try {
                            var resp = JSON.parse(xhr.responseText);
                            if (resp && resp.tx) {
                                tx = resp.tx;
                            }
                        } catch (e) {
                            // Ignore JSON parse errors
                        }
                    }

                    msgbox.failure(tx);

                },

                complete: function () {

                    progressbar.init();

                }

            });

        });

        jQuery(".repr_week").on("click", function (e) {

            e.preventDefault();

            const plot = jQuery(this).data("plot");
            const vmin = jQuery(this).data("vmin");
            const vmax = jQuery(this).data("vmax");

            if (!plot) return;

            areaChart.plot(plot, vmin, vmax);

        });

    });

});
