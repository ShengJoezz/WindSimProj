const fs = require('fs-extra');
const path = require('path');
const handlebars = require('handlebars');


class PdfDataService {
    constructor(baseDir) {
        this.baseDir = baseDir;
    }

    async prepareDataForPDF(caseId) {
        const caseDir = path.join(this.baseDir, caseId);
        const caseInfo = await fs.readJson(path.join(caseDir, 'case-info.json'));
        const turbineData = await this.getTurbineData(caseId);
        const charts = await this.generateCharts(caseId, turbineData); // Pass caseId to generateCharts

        return {
            caseName: caseInfo.caseName,
            dateGenerated: new Date().toLocaleDateString(),
            turbineData: turbineData,
            charts: charts,
            vtkImages: await this.getVTKImages(caseId),
            velocityImages: await this.getVelocityImages(caseId)
        };
    }

    async generatePDF(caseId, pdfData) {
        const templateContent = await fs.readFile(path.join(__dirname, '../templates/report-template.html'), 'utf8');
        const template = handlebars.compile(templateContent);
        const html = template(pdfData);

        const pdfBuffer = await chartService.generatePdfFromHtml(html);
        return pdfBuffer;
    }


    async getTurbineData(caseId) {
        try {
            const turbineDataPath = path.join(this.baseDir, caseId, 'turbine-data.json');
            await fs.ensureFile(turbineDataPath); // Ensure file exists
            const data = await fs.readJson(turbineDataPath);
            return data;
        } catch (error) {
            console.error("Error reading or ensuring turbine data file:", error);
            return { error: "Failed to load turbine data" }; // Return an error object
        }
    }


    async getVTKImages(caseId) {
        const imagesDir = path.join(this.baseDir, caseId, 'pdf-assets', 'vtk-images');
        await fs.ensureDir(imagesDir);
        let images = {};
        try {
            images = {
                model3D: await this.ensureBase64DataURI(path.join(imagesDir, 'model-3d.png')),
                topView: await this.ensureBase64DataURI(path.join(imagesDir, 'top-view.png')),
                sideView: await this.ensureBase64DataURI(path.join(imagesDir, 'side-view.png')),
                frontView: await this.ensureBase64DataURI(path.join(imagesDir, 'front-view.png'))
            };
        } catch (error) {
            console.error("Error loading VTK images:", error);
            return { error: "Failed to load VTK images" }; // Return an error object
        }
        return images;
    }

    async getVelocityImages(caseId) {
        const imagesDir = path.join(this.baseDir, caseId, 'pdf-assets', 'velocity-images');
        await fs.ensureDir(imagesDir);
        let images = {};
        try {
            for (let i = 1; i <= 5; i++) { // Assuming 5 layers, adjust as needed
                images[`layer${i}`] = await this.ensureBase64DataURI(path.join(imagesDir, `layer${i}.png`));
            }
        } catch (error) {
            console.error("Error loading velocity images:", error);
            return { error: "Failed to load velocity images" }; // Return an error object
        }
        return images;
    }

    async ensureBase64DataURI(imagePath) {
        try {
            await fs.access(imagePath); // Check if the file exists
            const imageBuffer = await fs.readFile(imagePath);
            const base64Image = imageBuffer.toString('base64');
            return `data:image/png;base64,${base64Image}`;
        } catch (error) {
            console.warn(`Image file not found or accessible: ${imagePath}`);
            return null; // Return null if the image is not found
        }
    }


    async generateCharts(caseId, turbineData) {
        const chartsDir = path.join(this.baseDir, caseId, 'pdf-assets', 'charts');
        await fs.ensureDir(chartsDir);

        try {
            // Generate all charts
            const charts = {};

            // Track chart generation success/failure
            console.log(`Starting chart generation for case ${caseId}`);

            // Distribution chart (the one that works)
            try {
                charts.turbineDistribution = await this.generateTurbineDistributionChart(turbineData, chartsDir);
                console.log(`✅ Successfully generated turbine distribution chart: ${charts.turbineDistribution ? 'Data present' : 'No data'}`);
            } catch (err) {
                console.error(`Error generating turbine distribution chart: ${err.message}`);
                charts.turbineDistribution = null;
            }

            // Speed comparison chart
            try {
                charts.speedComparison = await this.generateSpeedComparisonChart(turbineData, chartsDir);
                console.log(`${charts.speedComparison ? '✅' : '❌'} Speed comparison chart generation: ${charts.speedComparison ? 'Successful' : 'Failed'}`);

                // Verify the data is correctly formatted
                if (charts.speedComparison) {
                    console.log(`Speed comparison chart data starts with: ${charts.speedComparison.substring(0, 50)}...`);
                }
            } catch (err) {
                console.error(`Error generating speed comparison chart: ${err.message}`);
                charts.speedComparison = null;
            }

            // Power comparison chart (similar checks)
            try {
                charts.powerComparison = await this.generatePowerComparisonChart(turbineData, chartsDir);
                console.log(`${charts.powerComparison ? '✅' : '❌'} Power comparison chart generation: ${charts.powerComparison ? 'Successful' : 'Failed'}`);
                if (charts.powerComparison) {
                    console.log(`Power comparison chart data starts with: ${charts.powerComparison.substring(0, 50)}...`);
                }
            } catch (err) {
                console.error(`Error generating power comparison chart: ${err.message}`);
                charts.powerComparison = null;
            }

            return charts;
        } catch (error) {
            console.error(`Error in chart generation process: ${error.message}`);
            // Return at least the working chart and placeholders for others
            return {
                turbineDistribution: await this.generateTurbineDistributionChart(turbineData, chartsDir),
                speedComparison: null,
                powerComparison: null
            };
        }
    }


    async generateSpeedComparisonChart(turbineData, chartsDir) {
        if (!turbineData || !turbineData.combinedData || turbineData.combinedData.length === 0) {
            console.warn("No turbine data available to generate Speed Comparison Chart.");
            return null;
        }

        const chartConfig = chartService.createSpeedComparisonChartConfig(turbineData.combinedData);
        if (!chartConfig) {
            console.error("Failed to create chart configuration for Speed Comparison Chart.");
            return null;
        }

        try {
            const canvas = chartService.renderChart(chartConfig);
            if (!canvas) {
                throw new Error('Canvas rendering failed');
            }

            // Save to file
            const fileName = 'speed-comparison.png';
            const filePath = path.join(chartsDir, fileName);
            const buffer = canvas.toBuffer('image/png');
            await fs.writeFile(filePath, buffer);

            // Clean data URI construction
            try {
                // Test reading from the file to ensure it was written correctly
                const fileBuffer = await fs.readFile(filePath);
                const base64Data = fileBuffer.toString('base64');
                const dataURI = `data:image/png;base64,${base64Data}`;

                // Verify data URI starts correctly
                if (!dataURI.startsWith('data:image/png;base64,')) {
                    throw new Error('Invalid data URI format');
                }

                return dataURI;
            } catch (error) {
                console.error(`Error creating data URI for speed comparison chart: ${error.message}`);
                return null;
            }

        } catch (error) {
            console.error("Error generating Speed Comparison Chart:", error);
            return null;
        }
    }


    async generatePowerComparisonChart(turbineData, chartsDir) {
        if (!turbineData || !turbineData.combinedData || turbineData.combinedData.length === 0) {
            console.warn("No turbine data available to generate Power Comparison Chart.");
            return null;
        }
        const chartConfig = chartService.createPowerComparisonChartConfig(turbineData.combinedData);
        if (!chartConfig) {
            console.error("Failed to create chart configuration for Power Comparison Chart.");
            return null;
        }

        try {
            const canvas = chartService.renderChart(chartConfig);
            if (!canvas) {
                throw new Error('Canvas rendering failed');
            }
            // Save to file
            const fileName = 'power-comparison.png';
            const filePath = path.join(chartsDir, fileName);
            const buffer = canvas.toBuffer('image/png');
            await fs.writeFile(filePath, buffer);

            // Construct data URI from file
            try {
                const fileBuffer = await fs.readFile(filePath);
                const base64Data = fileBuffer.toString('base64');
                const dataURI = `data:image/png;base64,${base64Data}`;
                if (!dataURI.startsWith('data:image/png;base64,')) {
                    throw new Error('Invalid data URI format');
                }
                return dataURI;
            } catch (error) {
                console.error(`Error creating data URI for power comparison chart: ${error.message}`);
                return null;
            }

        } catch (error) {
            console.error("Error generating Power Comparison Chart:", error);
            return null;
        }
    }


    async generateTurbineDistributionChart(turbineData, chartsDir) {
        if (!turbineData || !turbineData.realHighData || turbineData.realHighData.length === 0) {
            console.warn("No turbine location data available to generate Turbine Distribution Chart.");
            return null;
        }
        const chartConfig = chartService.createTurbineDistributionChartConfig(turbineData.realHighData);
        if (!chartConfig) {
            console.error("Failed to create chart configuration for Turbine Distribution Chart.");
            return null;
        }

        try {
            const canvas = chartService.renderChart(chartConfig);
            if (!canvas) {
                throw new Error('Canvas rendering failed');
            }
            const dataUrl = canvas.toDataURL();
            return dataUrl;
        } catch (error) {
            console.error("Error generating Turbine Distribution Chart:", error);
            return null;
        }
    }
}

module.exports = PdfDataService;