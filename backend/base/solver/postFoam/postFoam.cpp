#include "fvCFD.H"
#include <iostream>        // 标准输入输出
#include <fstream>         // 文件输入输出
#include <string>          // 字符串处理
#include <iomanip>         // 控制输入输出格式
#include <sstream>         // 字符串流，用于数值转换
#include <vector>          // 动态数组容器
#include "cJSON.h"         // 用于解析JSON文件

void printProgressBar(int progress, int total) {
    float ratio = static_cast<float>(progress) / total;  // 使用 static_cast
    int barWidth = 50;  // 设置进度条的长度
    int pos = static_cast<int>(barWidth * ratio);

    std::cout << "[";
    for (int i = 0; i < barWidth; ++i) {
        if (i < pos) std::cout << "=";
        else if (i == pos) std::cout << ">";
        else std::cout << " ";
    }
    std::cout << "] " << static_cast<int>(ratio * 100.0) << " %\r"; // 显示百分比
    std::cout.flush();  // 刷新输出缓冲区
}

std::string doubleToString(double value) {
    // 创建输出字符串流
    std::ostringstream oss;

    // 设置为固定格式，保留零位小数
    oss << std::fixed << std::setprecision(0) << value;

    // 返回转换后的字符串
    return oss.str();
}

int main(int argc, char *argv[])
{
    // 初始化OpenFOAM运行环境
    #include "setRootCase.H"  // OpenFOAM运行环境初始化
    #include "createTime.H"    // 创建与时间相关的变量和对象
    #include "createMesh.H"    // 创建和读取网格对象

    // 获取最新的时间步文件夹
    const word latestTime = runTime.timeName();

    // 读取风速U和压强p
    volVectorField U
    (
        IOobject
        (
            "U",                  // 字段名称
            runTime.timeName(),   // 时间步名称
            mesh,                 // 网格
            IOobject::MUST_READ,  // 读取模式
            IOobject::AUTO_WRITE  // 写入模式
        ),
        mesh
    );

    volScalarField p
    (
        IOobject
        (
            "p",                  // 字段名称
            runTime.timeName(),   // 时间步名称
            mesh,                 // 网格
            IOobject::MUST_READ,  // 读取模式
            IOobject::AUTO_WRITE  // 写入模式
        ),
        mesh
    );

    std::ifstream inB, inR;
	std::ofstream out;
	
	inB.open("./constant/polyMesh/boundary");
	string line, str_a, str_b;
	int n_f, sta_f;

	while (getline(inB, line))
	{
		if (line == "    bot")
			break;
	}
	getline(inB, line);
	getline(inB, line);
	// getline(inB, line);
	inB >> str_a >> n_f >> str_b >> str_a >> sta_f;
	// std::cout << "nFaces =" << n_f << std::endl;
	inB.close();

	// std::cout << "读取 boundary 结束！" << std::endl;
	// std::cout << "\n" << std::endl;

	int num, num1, num_ceng;
	long double *px, *py, *pz, *hh0, *ux, *uy, *uz, *pp, *z0;

    num = mesh.nCells();
	num1 = n_f; num_ceng = num / num1;
	// std::cout << "num_ceng =" << num_ceng << std::endl << "num=" << num << std::endl;

	px = new long double[num]; py = new long double[num]; pz = new long double[num]; z0 = new long double[num1];
	hh0 = new long double[num]; ux = new long double[num]; uy = new long double[num]; uz = new long double[num]; pp = new long double[num];
	
    forAll(mesh.C(), cellI)
    {
        px[cellI] = mesh.C()[cellI].x();
        py[cellI] = mesh.C()[cellI].y();
        pz[cellI] = mesh.C()[cellI].z();
        ux[cellI] = U[cellI].x();
        uy[cellI] = U[cellI].y();
        uz[cellI] = U[cellI].z();
        pp[cellI] = p[cellI];
	}
	// cout << px[4000] << endl << py[4000] << endl;
	// std::cout << "读取 result 结束！" << std::endl;

	for (int i = 0; i<num1; i++)
	{
		z0[i] = pz[i];
	}
	
	/*******************************read_input.json*******************************/
	double lt, h, h1, ceng, scale, meshSize;
	int num_udh;
	
	FILE *file0;
	file0 = fopen("./Input/input.json", "r");
    fseek(file0, 0, SEEK_END);
    long file_size = ftell(file0);
    fseek(file0, 0, SEEK_SET);
    char *json_str = (char *)malloc(file_size + 1);
    fread(json_str, 1, file_size, file0);
    fclose(file0);

    cJSON *cjson = cJSON_Parse(json_str);

    cJSON *cjson_domain = cJSON_GetObjectItem(cjson, "domain");
    cJSON *cjson_domain_lt = cJSON_GetObjectItem(cjson_domain, "lt");
    cJSON *cjson_domain_h = cJSON_GetObjectItem(cjson_domain, "h");

    cJSON *cjson_mesh = cJSON_GetObjectItem(cjson, "mesh");
    cJSON *cjson_mesh_h1 = cJSON_GetObjectItem(cjson_mesh, "h1");
    cJSON *cjson_mesh_ceng = cJSON_GetObjectItem(cjson_mesh, "ceng");
    cJSON *cjson_mesh_scale = cJSON_GetObjectItem(cjson_mesh, "scale");
	
	cJSON *cjson_post = cJSON_GetObjectItem(cjson, "post");
    cJSON *cjson_post_num_udh = cJSON_GetObjectItem(cjson_post, "num_udh");
    cJSON *cjson_post_udh = cJSON_GetObjectItem(cjson_post, "udh");
    cJSON *cjson_post_meshSize = cJSON_GetObjectItem(cjson_post, "meshSize");
    cJSON *cjson_udh = cJSON_GetArrayItem(cjson_post_udh, 0);
    
    lt = cjson_domain_lt->valuedouble;
    h = cjson_domain_h->valuedouble;
    h1 = cjson_mesh_h1->valuedouble;
	ceng = cjson_mesh_ceng->valuedouble;
    scale = cjson_mesh_scale->valuedouble;
    num_udh = cjson_post_num_udh->valueint;
	meshSize = cjson_post_meshSize->valuedouble;
	// std::cout << "num_udh=" << num_udh <<std::endl;

	long double hh = h1 / ceng;
	long double *udh;
	udh = new long double[num_udh];

	for (int i = 0; i<num_udh; i++)
	{
		cjson_udh = cJSON_GetArrayItem(cjson_post_udh, i);
		udh[i] = cjson_udh->valuedouble;
		// std::cout << "udh=" << udh[i] << std::endl;
	}
	// std::cout << "读取 input.json 结束！" << std::endl;
	// std::cout << "\n" << std::endl;
	/*******************************end_read_input.json*******************************/

	long double **res_ux = new long double *[num_udh];
	for (int i = 0; i<num_udh; i++)
	{
		res_ux[i] = new long double[num1];
	}
	long double **res_uy = new long double *[num_udh];
	for (int i = 0; i<num_udh; i++)
	{
		res_uy[i] = new long double[num1];
	}
	long double **res_uz = new long double *[num_udh];
	for (int i = 0; i<num_udh; i++)
	{
		res_uz[i] = new long double[num1];
	}
	long double **res_p = new long double *[num_udh];
	for (int i = 0; i<num_udh; i++)
	{
		res_p[i] = new long double[num1];
	}
	long double **res_z = new long double *[num_udh];
	for (int i = 0; i<num_udh; i++)
	{
		res_z[i] = new long double[num1];
	}
	int numm;
	for (int j = 0; j<num1; j++)
	{
		for (int k = 0; k<num_ceng; k++)
		{
			numm = k*num1 + j;
			hh0[numm] = pz[numm] - (2.0*z0[j] - hh*scale)*h / (2.0*h - hh);
			// std::cout << "hh0[" << numm << "]=" << hh0[numm] << std::endl;
		}
	}
	long double *hhh0;
	hhh0 = new long double[num_ceng];
	for (int i = 0; i < num_ceng; i++)
	{
		hhh0[i] = hh0[i*num1];
	}

	int tempI, tempJ;
	double temp1, temp2;
	for (int i = 0; i<num_udh; i++)
	{
        std::string fileName = doubleToString(udh[i]);
        std::string fullPath = "./Output/plt/" + fileName;
        out.open(fullPath);
        // std::cout << "plane" << i + 1 << "  " << udh[i] << "m above the ground" << std::endl;
		for (int j = 0; j < num_ceng; j++)
		{
            printProgressBar(i * num_ceng + j + 1, num_udh * num_ceng);

			if (udh[i] * scale >= hhh0[j] && udh[i] * scale < hhh0[j + 1])
			{
				// std::cout << "hh0[" << j << "]=" << hh0[j] << std::endl;
				for (int k = 0; k < num1; k++)
				{
					tempI = (j + 1)* num1 + k;
					tempJ = j*num1 + k;
					temp1 = udh[i] * scale - hhh0[j];
					temp2 = hhh0[j + 1] - hhh0[j];
					res_ux[i][k] = (ux[tempI] - ux[tempJ]) * temp1 / temp2 + ux[j*num1 + k];
					res_uy[i][k] = (uy[tempI] - uy[tempJ]) * temp1 / temp2 + uy[j*num1 + k];
					res_uz[i][k] = (uz[tempI] - uz[tempJ]) * temp1 / temp2 + uz[j*num1 + k];
					res_p[i][k] =  (pp[tempI] - pp[tempJ]) * temp1 / temp2 + pp[j*num1 + k];
					// res_z[i][k] = (pz[(j + 1)* num1 + k] - pz[j*num1 + k])*(udh[i] * scale - hhh0[j]) / (hhh0[j + 1] - hhh0[j]) + pz[j*num1 + k];
					res_z[i][k] = udh[i] * scale + (2.0*z0[k] - hh*scale)*h / (2.0*h - hh);
					out << px[k] << "  " << py[k] << "  " << res_z[i][k] << "  " << res_ux[i][k] << "  " << res_uy[i][k] << "  " << res_uz[i][k] << "  " << res_p[i][k] << "\n";
				}
			}
		}
        out.close();
	}
	
	// cout << "写入 Mesh_XYZ_U_P 结束！" << endl;
    cout << "\n\n" << endl;

	delete[] hh0, delete[] ux, delete[] uy, delete[] uz, delete[] pp, delete[] z0;
	delete[] px, delete[] py, delete[] pz,  delete[] udh, delete[] hhh0;

	for (int i = 0; i<num_udh; i++)
	{
		delete[]res_ux[i];
	}
	res_ux = NULL;
	for (int i = 0; i<num_udh; i++)
	{
		delete[]res_uy[i];
	}
	res_uy = NULL;
	for (int i = 0; i<num_udh; i++)
	{
		delete[]res_uz[i];
	}
	res_uz = NULL;
	for (int i = 0; i<num_udh; i++)
	{
		delete[]res_p[i];
	}
	res_p = NULL;

    return 0;
}
