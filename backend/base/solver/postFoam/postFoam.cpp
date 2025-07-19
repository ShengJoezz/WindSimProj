/*---------------------------------------------------------------------------*\
  postFoam.cpp
  插值后处理：在指定高度处输出 (x y z Ux Uy Uz p)
  - 支持 "dh" 为标量或数组
  - 兼容 OpenFOAM-v2212 + C++11
\*---------------------------------------------------------------------------*/

#include "fvCFD.H"

#include <iostream>
#include <fstream>
#include <iomanip>
#include <sstream>
#include <vector>
#include <string>
#include "cJSON.h"

//==========================================================================//
// 辅助工具
//==========================================================================//

void printProgressBar(int progress, int total)
{
    if (total <= 0) return;
    const float ratio   = static_cast<float>(progress) / total;
    const int   barW    = 50;
    const int   pos     = static_cast<int>(barW * ratio);

    std::cout << "[";
    for (int i = 0; i < barW; ++i)
        std::cout << (i < pos ? "=" : (i == pos ? ">" : " "));
    std::cout << "] " << std::setw(3) << static_cast<int>(ratio * 100.0) << " %\r";
    std::cout.flush();
}

std::string doubleToString(double v)
{
    std::ostringstream os;
    os << std::fixed << std::setprecision(0) << v;
    return os.str();
}

cJSON* getCheckedObject(cJSON* parent, const char* key)
{
    if (!parent)
    {
        std::cerr << "[FATAL] NULL JSON parent when looking for key '" << key << "'\n";
        exit(EXIT_FAILURE);
    }
    cJSON* item = cJSON_GetObjectItem(parent, key);
    if (!item)
    {
        std::cerr << "[FATAL] JSON key '" << key << "' not found!\n";
        exit(EXIT_FAILURE);
    }
    return item;
}

//==========================================================================//
// 主程序
//==========================================================================//

int main(int argc, char* argv[])
{
    std::cout << "[DEBUG] Step 0: Program start.\n";

    #include "setRootCase.H"
    #include "createTime.H"
    #include "createMesh.H"

    std::cout << "[DEBUG] Step 1: OpenFOAM environment and mesh created.\n";
    std::cout << "[DEBUG]        Latest time is: " << runTime.timeName() << '\n';

    Foam::volVectorField U
    (
        IOobject("U", runTime.timeName(), mesh, IOobject::MUST_READ, IOobject::AUTO_WRITE),
        mesh
    );
    Foam::volScalarField p
    (
        IOobject("p", runTime.timeName(), mesh, IOobject::MUST_READ, IOobject::AUTO_WRITE),
        mesh
    );
    std::cout << "[DEBUG] Step 2: Field data (U,p) loaded.\n";

    // ------------- 解析 boundary，获取底面面数 n_f -------------
    std::ifstream inB("./constant/polyMesh/boundary");
    if (!inB.is_open())
    {
        std::cerr << "[FATAL] Cannot open ./constant/polyMesh/boundary\n";
        return EXIT_FAILURE;
    }
    std::string line, w1, w2;
    int n_f = 0, sta_f = 0;
    while (std::getline(inB, line))
        if (line.find("bot") != std::string::npos && line.find('{') == std::string::npos) break;
    std::getline(inB, line);
    std::getline(inB, line);
    inB >> w1 >> n_f >> w2 >> w1 >> sta_f;
    inB.close();

    if (n_f == 0) { std::cerr << "[FATAL] nFaces == 0\n"; return EXIT_FAILURE; }
    const int numCells = mesh.nCells();
    const int base     = n_f;
    const int nLayers  = numCells / base;
    std::cout << "[DEBUG] Step 3: Cells total=" << numCells
              << ", Base=" << base << ", Layers=" << nLayers << '\n';

    // 拷贝场数据
    std::vector<long double> px(numCells), py(numCells), pz(numCells);
    std::vector<long double> ux(numCells), uy(numCells), uz(numCells), pp(numCells);
    forAll(mesh.C(), cI)
    {
        px[cI] = mesh.C()[cI].x();
        py[cI] = mesh.C()[cI].y();
        pz[cI] = mesh.C()[cI].z();
        ux[cI] = U[cI].x();  uy[cI] = U[cI].y();  uz[cI] = U[cI].z();
        pp[cI] = p[cI];
    }
    std::vector<long double> z0(base);
    for (int i = 0; i < base; ++i) z0[i] = pz[i];
    std::cout << "[DEBUG] Step 4: Arrays prepared.\n";

    // ======================== 读取 Input/input.json =========================
    FILE* fp = fopen("./Input/input.json", "r");
    if (!fp) { std::cerr << "[FATAL] Cannot open ./Input/input.json\n"; return EXIT_FAILURE; }

    fseek(fp, 0, SEEK_END);
    long fsz = ftell(fp);
    rewind(fp);

    std::string jsonStr;
    jsonStr.resize(fsz);
    if (fread(&jsonStr[0], 1, fsz, fp) != static_cast<size_t>(fsz))
    {
        std::cerr << "[FATAL] fread failed.\n";
        fclose(fp);
        return EXIT_FAILURE;
    }
    fclose(fp);

    cJSON* root = cJSON_Parse(jsonStr.c_str());
    if (!root) { std::cerr << "[FATAL] JSON parse error\n"; return EXIT_FAILURE; }

    cJSON* jDomain = getCheckedObject(root, "domain");
    cJSON* jMesh   = getCheckedObject(root, "mesh");
    cJSON* jPost   = getCheckedObject(root, "post");

    double h     = getCheckedObject(jDomain, "h")->valuedouble;
    double h1    = getCheckedObject(jMesh,   "h1")->valuedouble;
    double ceng  = getCheckedObject(jMesh,   "ceng")->valuedouble;
    double scale = getCheckedObject(jMesh,   "scale")->valuedouble;

    // --- MODIFICATION START ---
    // 修改: JSON键名从 "numh" 改为 "num_udh"，C++变量名也相应修改
    int num_udh   = getCheckedObject(jPost, "num_udh")->valueint;
    // 修改: JSON键名从 "dh" 改为 "udh"，C++ JSON对象指针也相应修改
    cJSON* jUdh = getCheckedObject(jPost, "udh");

    // 修改: 使用新的变量名 num_udh 来初始化vector
    std::vector<long double> udh(num_udh);
    // 修改: 使用新的JSON对象指针 jUdh
    if (cJSON_IsArray(jUdh))
    {
        // 修改: 使用新的变量名 num_udh 进行数量检查
        int arrSz = cJSON_GetArraySize(jUdh);
        if (arrSz != num_udh)
        {
            std::cerr << "[FATAL] num_udh (" << num_udh << ") != udh.size() (" << arrSz << ")\n";
            cJSON_Delete(root);
            return EXIT_FAILURE;
        }
        // 修改: 使用新的JSON对象指针 jUdh 提取数组元素
        for (int i = 0; i < arrSz; ++i)
            udh[i] = cJSON_GetArrayItem(jUdh, i)->valuedouble;
    }
    else
    {
        // 如果 "udh" 是一个标量值而不是数组，这段逻辑依然保留（尽管在你的JSON中它是数组）
        // 修改: 使用新的JSON对象指针 jUdh
        double dh_val = jUdh->valuedouble;
        // 修改: 使用新的变量名 num_udh
        for (int i = 0; i < num_udh; ++i) udh[i] = (i + 1) * dh_val;
    }
    // --- MODIFICATION END ---
    
    cJSON_Delete(root);
    std::cout << "[DEBUG] Step 5: JSON parsed. First height=" << udh.front() << '\n';

    // ======================== 几何辅助量 =========================
    const long double hh  = h1 / ceng;
    std::vector<long double> hh0(numCells);
    for (int j = 0; j < base; ++j)
        for (int k = 0; k < nLayers; ++k)
        {
            int id = k * base + j;
            hh0[id] = pz[id] - (2.0 * z0[j] - hh * scale) * h / (2.0 * h - hh);
        }
    std::vector<long double> hhh0(nLayers);
    for (int k = 0; k < nLayers; ++k) hhh0[k] = hh0[k * base];
    std::cout << "[DEBUG] Step 6: hh0 computed.\n";

    // ======================== 结果数组 =========================
    // 修改: 使用新的变量名 num_udh 初始化结果数组
    std::vector< std::vector<long double> > resUx(num_udh, std::vector<long double>(base));
    std::vector< std::vector<long double> > resUy(num_udh, std::vector<long double>(base));
    std::vector< std::vector<long double> > resUz(num_udh, std::vector<long double>(base));
    std::vector< std::vector<long double> > resP (num_udh, std::vector<long double>(base));
    std::vector< std::vector<long double> > resZ (num_udh, std::vector<long double>(base));

    // ======================== 主循环 =========================
    // 修改: 使用新的变量名 num_udh 计算总进度
    const int totalProg = num_udh * (nLayers - 1);
    int prog = 0;

    // 修改: 使用新的变量名 num_udh 作为循环上界
    for (int i = 0; i < num_udh; ++i)
    {
        std::ofstream fout("./Output/plt/" + doubleToString(udh[i]));
        if (!fout.is_open())
        {
            std::cerr << "[WARNING] Cannot open output file for z=" << udh[i] << '\n';
            continue;
        }

        const double zPlane = udh[i] * scale;

        for (int j = 0; j < nLayers - 1; ++j)
        {
            printProgressBar(++prog, totalProg);
            if (hhh0[j + 1] > hhh0[j] && zPlane >= hhh0[j] && zPlane < hhh0[j + 1])
            {
                for (int k = 0; k < base; ++k)
                {
                    int upper = (j + 1) * base + k;
                    int lower =  j      * base + k;
                    const double w = (zPlane - hhh0[j]) / (hhh0[j + 1] - hhh0[j]);

                    resUx[i][k] = (1 - w) * ux[lower] + w * ux[upper];
                    resUy[i][k] = (1 - w) * uy[lower] + w * uy[upper];
                    resUz[i][k] = (1 - w) * uz[lower] + w * uz[upper];
                    resP [i][k] = (1 - w) * pp[lower] + w * pp[upper];
                    resZ [i][k] = zPlane + (2.0 * z0[k] - hh * scale) * h / (2.0 * h - hh);

                    fout << px[k] << '\t' << py[k] << '\t' << resZ[i][k] << '\t'
                         << resUx[i][k] << '\t' << resUy[i][k] << '\t'
                         << resUz[i][k] << '\t' << resP[i][k]  << '\n';
                }
            }
        }
        fout.close();
    }
    std::cout << "\n[DEBUG] Step 7: Interpolation finished. Program exit.\n";
    return 0;
}